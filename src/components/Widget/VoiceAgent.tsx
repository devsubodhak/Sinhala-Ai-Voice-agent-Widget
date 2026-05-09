import React, { useState, useEffect, useRef } from 'react';
import { Mic2, MessageSquare, X, Volume2, VolumeX, Loader2, Calendar, LogOut } from 'lucide-react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface Props {
  agentId: string;
}

export default function VoiceAgent({ agentId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [visualizer, setVisualizer] = useState<number[]>(Array(20).fill(10));
  const [activeTab, setActiveTab] = useState<'voice' | 'conversation'>('voice');
  const [messages, setMessages] = useState<{id: string, role: 'user' | 'agent', text: string, timestamp: number}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (activeTab === 'conversation' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const addOrUpdateMessage = (role: 'user' | 'agent', text: string, id?: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => {
      const msgId = id || `${role}-${Date.now()}`;
      const existingIndex = prev.findIndex(m => m.id === msgId);
      
      if (existingIndex > -1) {
        // Update existing partial message
        const newMessages = [...prev];
        newMessages[existingIndex] = { ...newMessages[existingIndex], text };
        return newMessages;
      } else {
        // Add new message
        // If it's a new message but looks like a duplicate of the very last one (within a short window), skip
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === role && lastMsg.text === text && Date.now() - lastMsg.timestamp < 2000) {
          return prev;
        }
        return [...prev, { id: msgId, role, text, timestamp: Date.now() }];
      }
    });
  };
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const configRef = useRef<any>(null);
  const knowledgeRef = useRef<string>('');
  const startTimeRef = useRef<number>(0);

  const generateAndSaveSummary = async () => {
    if (messages.length === 0) {
      console.log("No transcript collected. Nothing to summarize.");
      return;
    }
    
    console.log("Generating summary... Transcript lines:", messages.length);
    
    const fullTranscript = messages
      .map(t => `${t.role.toUpperCase()}: ${t.text}`)
      .join('\n');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Please summarize this transcript:\n\n${fullTranscript}`,
        config: {
          systemInstruction: "You are a professional business analyst. Summarize voice calls concisely, focusing on customer intent, outcomes, and contact details."
        }
      });

      const summaryText = response.text || 'Conversation ended without a clear summary.';
      
      const summaryData = {
        agentId,
        sessionId: sessionRef.current?.sessionId || `voice_${Date.now()}`,
        summary: summaryText,
        timestamp: serverTimestamp(),
        duration: Math.round((Date.now() - startTimeRef.current) / 1000)
      };

      console.log("Attempting to save summary to Firestore...");
      try {
        const docRef = await addDoc(collection(db, 'summaries'), summaryData);
        console.log("Summary saved successfully with ID:", docRef.id);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'summaries');
      }
    } catch (e) {
      console.error("Summary generation failed:", e);
    }
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const initSession = async () => {
    setIsConnecting(true);
    setMessages([]);
    setMicError(null);
    startTimeRef.current = Date.now();
    
    try {
      // Ensure user is authenticated (even if anonymously) to write to Firestore
      if (!auth.currentUser) {
        console.log("Signing in anonymously...");
        await signInAnonymously(auth);
      }

      // 1. Fetch Config & Knowledge
      const configRef_doc = doc(db, 'config', agentId);
      let configSnap;
      try {
        configSnap = await getDoc(configRef_doc);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, `config/${agentId}`);
      }

      if (configSnap && configSnap.exists()) {
        configRef.current = configSnap.data();
      }

      let kSnap;
      try {
        const kQuery = query(collection(db, 'knowledgeBase'), where('userId', '==', agentId));
        kSnap = await getDocs(kQuery);
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'knowledgeBase');
      }
      
      if (kSnap) {
        knowledgeRef.current = kSnap.docs.map(d => `${d.data().title}: ${d.data().content}`).join('\n\n');
      }

      // 3. Connect to Gemini Live
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
          },
          onmessage: async (msg) => {
            console.log("Message:", msg);
            
            // 1. Capture Agent (Model) Turn Text
            if (msg.serverContent?.modelTurn?.parts) {
              const text = msg.serverContent.modelTurn.parts
                .map(p => p.text)
                .filter(Boolean)
                .join(' ');
              
              if (text) {
                setLastTranscript(text);
                addOrUpdateMessage('agent', text);
              }
              
              const audioData = msg.serverContent.modelTurn.parts.find(p => p.inlineData)?.inlineData?.data;
              if (audioData) playAudio(audioData);
            }

            // 2. Capture Transcription Messages
            const serverContent = msg.serverContent as any;
            const anyMsg = msg as any;
            const userText = serverContent?.inputAudioTranscription?.text;
            const agentText = serverContent?.outputAudioTranscription?.text;

            if (userText) {
              addOrUpdateMessage('user', userText);
            }
            if (agentText) {
              addOrUpdateMessage('agent', agentText);
            }

            // 3. Fallback: User Turn Parts
            if (serverContent?.userTurn?.parts) {
              const uText = serverContent.userTurn.parts.map((p: any) => p.text).filter(Boolean).join(' ');
              if (uText) {
                addOrUpdateMessage('user', uText);
              }
            }

            const toolCall = msg.toolCall || anyMsg.tool_call;
            if (toolCall) {
              console.log("Tool call received:", toolCall);
              const session = sessionRef.current;
              if (!session) return;

              const functionCalls = toolCall.functionCalls || toolCall.function_calls;
              if (functionCalls) {
                for (const call of functionCalls) {
                  const callName = call.name;
                  const callArgs = call.args;
                  const callId = call.id;

                  if (callName === 'scheduleMeeting') {
                    const { name, contact, time, reason } = callArgs as any;
                    console.log("Executing scheduleMeeting:", { name, contact, time });
                    try {
                      const leadDoc = await addDoc(collection(db, 'leads'), {
                        agentId,
                        name,
                        contact,
                        time,
                        reason: reason || '',
                        status: 'new',
                        createdAt: serverTimestamp()
                      });
                      console.log("Lead saved with ID:", leadDoc.id);
                      
                      session.sendToolResponse({
                        functionResponses: [{
                          name: "scheduleMeeting",
                          response: { success: true, message: "Meeting scheduled successfully. I have captured your details." },
                          id: callId
                        }]
                      });
                    } catch (e) {
                      console.error("Tool execution error", e);
                      handleFirestoreError(e, OperationType.WRITE, 'leads');
                      session.sendToolResponse({
                        functionResponses: [{
                          name: "scheduleMeeting",
                          response: { success: false, message: "Could not save meeting details." },
                          id: callId
                        }]
                      });
                    }
                  }
                }
              }
            }

            if (msg.serverContent?.interrupted) {
              stopPlayback();
            }
          },
          onclose: async () => {
            console.log("Live API session closed.");
            setIsConnected(false);
            await generateAndSaveSummary();
            cleanup();
          },
          onerror: (e) => console.error("Live API Error", e)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: configRef.current?.voiceName || "Kore" } }
          },
          tools: [{
            functionDeclarations: [{
              name: "scheduleMeeting",
              description: "Schedules a meeting or captures a lead for the business. Use this when the user wants to book a call, meeting, or have someone contact them.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The name of the user." },
                  contact: { type: Type.STRING, description: "Phone number or email address of the user." },
                  time: { type: Type.STRING, description: "Preferred date and time for the meeting (e.g., 'Tomorrow at 3pm', 'Next Friday morning')." },
                  reason: { type: Type.STRING, description: "The reason or topic for the meeting." }
                },
                required: ["name", "contact", "time"]
              }
            }]
          }],
          systemInstruction: `
            ${configRef.current?.systemInstruction || 'You are a helpful business voice assistant.'}
            Business Name: ${configRef.current?.businessName || 'Our Business'}
            
            Multi-language Support:
            - You are fully proficient in both English and Sinhala (සිංහල).
            - Always respond in the same language the user uses.
            - If the user speaks Sinhala, respond in clear, natural, and polite Sinhala.
            - If the user speaks English, respond in professional English with a warm, natural, and friendly tone.
            
            Knowledge Base:
            ${knowledgeRef.current}
            
            Instructions:
            - Answer questions based ONLY on the provided knowledge base.
            - If you don't know the answer, politely say so and offer to have a real person contact them by scheduling a meeting.
            - If the user wants to book a meeting or talk to a real person, use the 'scheduleMeeting' tool. Ask for their name, contact details, and preferred time if not provided.
            - Keep responses concise and natural for voice interaction.
            - IMPORTANT: Use a bright, crystalline, and professional female voice. Speak with a pleasant, natural pitch and friendly inflection.
            - Aim for studio-quality clarity. Avoid any low-pitched, monotonous, or ghostly tones. Respond with higher energy and brightness.
          `,
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error("Session Init Error", err);
      setIsConnecting(false);
    }
  };

  const startMic = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not available in this browser context.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        // Base64 encode
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=24000' }
          });
        }

        // Update visualizer
        const avg = inputData.reduce((a, b) => a + Math.abs(b), 0) / inputData.length;
        setVisualizer(v => {
          const next = [...v];
          next.shift();
          next.push(10 + avg * 100);
          return next;
        });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsListening(true);
      return true;
    } catch (err: any) {
      console.error("Mic Error", err);
      let msg = "Microphone access denied. Please enable it in your browser settings.";
      if (err.name === 'NotAllowedError' || err.message?.includes('denied')) {
        msg = "Microphone access denied. Please click the camera/mic icon in your browser address bar to allow access.";
      } else if (err.name === 'NotFoundError') {
        msg = "No microphone found. Please connect one and try again.";
      }
      setMicError(msg);
      setIsConnecting(false);
      setIsConnected(false);
      return false;
    }
  };

  const audioQueue = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  const playAudio = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcmData = new Int16Array(bytes.buffer);
    
    audioQueue.current.push(pcmData);
    if (!isPlayingRef.current) {
      processQueue();
    }
  };

  const processQueue = async () => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    
    const pcmData = audioQueue.current.shift()!;
    const length = pcmData.length;
    const audioBuffer = audioContextRef.current.createBuffer(1, length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    // Process PCM with a simple smoothing fade to prevent clicks
    const fadeSamples = Math.min(length / 10, 100);
    for (let i = 0; i < length; i++) {
        let val = pcmData[i] / 0x7FFF;
        // Fade in
        if (i < fadeSamples) val *= (i / fadeSamples);
        // Fade out
        if (i > length - fadeSamples) val *= ((length - i) / fadeSamples);
        channelData[i] = val;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      processQueue();
    };

    const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
  };

  const stopPlayback = () => {
    audioQueue.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  };

  const handleEndSession = async () => {
    setIsConnected(false);
    await generateAndSaveSummary();
    cleanup();
  };

  const cleanup = () => {
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
    }
    sessionRef.current = null;
    audioContextRef.current = null;
    nextStartTimeRef.current = 0;
    setIsConnected(false);
    setIsListening(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans antialiased">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-white w-[350px] rounded-[2.5rem] shadow-2xl border border-zinc-100 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-zinc-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Mic2 size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm">OmniVoice Assistant</h4>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-none">
                    {isConnected ? 'Live' : 'Initializing'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleEndSession}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-900 border-b border-white/5 px-4">
              <button 
                onClick={() => setActiveTab('voice')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'voice' ? "text-white border-white" : "text-zinc-500 border-transparent"
                )}
              >
                Voice
              </button>
              <button 
                onClick={() => setActiveTab('conversation')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'conversation' ? "text-white border-white" : "text-zinc-500 border-transparent"
                )}
              >
                Conversation
              </button>
            </div>

            {/* Visualizer Area */}
            <div className="flex-1 bg-[#FAF9F6] flex flex-col min-h-[400px]">
              {activeTab === 'voice' ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center">
                  <div className="flex items-end gap-1 h-24 mb-6">
                    {visualizer.map((h, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: isListening ? h : 4 }}
                        className={cn(
                          "w-1 rounded-full transition-all duration-75",
                          isSpeaking ? "bg-indigo-500" : "bg-zinc-300"
                        )}
                      />
                    ))}
                  </div>
                  
                  <div className="text-center space-y-4">
                    {micError ? (
                      <div className="flex flex-col items-center gap-3 px-6">
                        <div className="bg-red-100 p-3 rounded-full text-red-500">
                          <X size={24} />
                        </div>
                        <p className="text-red-500 text-sm font-medium leading-relaxed">
                          {micError}
                        </p>
                        <button 
                          onClick={async () => {
                            setMicError(null);
                            const started = await startMic();
                            if (started) initSession();
                          }}
                          className="bg-zinc-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : isConnecting ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={32} className="animate-spin text-zinc-400" />
                        <p className="text-zinc-500 text-sm font-medium">Connecting to AI...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-zinc-900 font-bold text-lg">
                          {isSpeaking ? 'AI is speaking...' : isListening ? 'Listening...' : 'Ready to talk'}
                        </p>
                        <div className="min-h-[60px] flex items-center justify-center px-4">
                          <p className="text-zinc-400 text-sm max-w-[200px] mx-auto italic leading-relaxed">
                            {lastTranscript || '"How can I help you today?"'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div 
                  ref={scrollRef}
                  className="flex-1 p-6 overflow-y-auto max-h-[400px] space-y-4 scroll-smooth"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                      <MessageSquare size={24} />
                      <p className="text-sm italic">Transcript will appear here...</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <motion.div 
                        key={m.id}
                        initial={{ opacity: 0, x: m.role === 'user' ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "flex flex-col max-w-[85%]",
                          m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <span className="text-[10px] text-zinc-400 font-bold uppercase mb-1 px-1">
                          {m.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <div className={cn(
                          "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                          m.role === 'user' 
                            ? "bg-zinc-900 text-white rounded-tr-none" 
                            : "bg-white border border-zinc-100 text-zinc-900 shadow-sm rounded-tl-none"
                        )}>
                          {m.text}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div className="h-1" /> {/* Spacer for scroll padding */}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-6 bg-white border-t border-zinc-100 flex items-center justify-center gap-4">
               {isConnected && (
                 <button 
                  onClick={handleEndSession}
                  className="bg-red-50 text-red-500 hover:bg-red-100 px-8 py-3 rounded-2xl transition-all font-bold text-sm flex items-center gap-2"
                 >
                  <LogOut size={18} />
                  End Call & Save
                 </button>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={async () => {
          if (isOpen) {
            handleEndSession();
          } else {
            setIsOpen(true);
            setMicError(null);
            const micStarted = await startMic();
            if (micStarted) {
              initSession();
            }
          }
        }}
        className={cn(
          "w-16 h-16 rounded-3xl shadow-2xl flex items-center justify-center transition-all duration-500",
          isOpen ? "bg-red-500 text-white rotate-90" : "bg-zinc-900 text-white"
        )}
      >
        {isOpen ? <X size={28} /> : <Mic2 size={28} />}
      </motion.button>
    </div>
  );
}
