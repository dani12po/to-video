/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Download, RotateCcw, Sparkles, AlertCircle, Key, ImageIcon } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Extension for window.aistudio
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type AppState = 'IDLE' | 'API_KEY_REQUIRED' | 'UPLOADING' | 'GENERATING' | 'RESULT' | 'ERROR';

export default function App() {
  const [status, setStatus] = useState<AppState>('IDLE');
  const [sourceImage, setSourceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid product image.');
      setStatus('ERROR');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage({
        base64: (e.target?.result as string).split(',')[1],
        mimeType: file.type
      });
      setStatus('IDLE');
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      // After selecting, try to generate if we have an image
      if (sourceImage) {
        generateVideo();
      } else {
        setStatus('IDLE');
      }
    }
  };

  const generateVideo = async () => {
    if (!sourceImage) return;

    // Check key again before generating
    let currentHasKey = hasApiKey;
    if (window.aistudio) {
      currentHasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(currentHasKey);
    }

    if (!currentHasKey) {
      setStatus('API_KEY_REQUIRED');
      return;
    }

    setStatus('GENERATING');
    setProgress(0);
    setError(null);

    try {
      // Create fresh instance right before call as per skill
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found. Please connect your API key.");

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = "A flawless elegant woman's hand with smooth skin gently reaches into frame, slowly picks up the product, and sways it softly in a smooth graceful motion. Close-up cinematic shot, slow motion, luxury advertisement feel. 9:16 vertical. Absolutely clean visuals, no text, no logos, no watermarks, no captions.";

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt,
        image: {
          imageBytes: sourceImage.base64,
          mimeType: sourceImage.mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      });

      // Polling
      let timer = 0;
      while (!operation.done) {
        timer++;
        // Reassuring messages based on timer
        setProgress(Math.min(timer * 4, 98)); 
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        try {
          operation = await ai.operations.getVideosOperation({ operation });
        } catch (opError: any) {
          if (opError.message?.includes("Requested entity was not found")) {
            setHasApiKey(false);
            throw new Error("Session expired. Please re-select your API key.");
          }
          throw opError;
        }
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) throw new Error('Failed to generate video.');

      // Fetch the video with API key in headers
      const videoResponse = await fetch(videoUri, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!videoResponse.ok) throw new Error('Failed to download generated video.');
      
      const videoBlob = await videoResponse.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      
      setGeneratedVideoUrl(videoUrl);
      setStatus('RESULT');
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating high-fashion motion.');
      setStatus('ERROR');
    }
  };

  const reset = () => {
    setSourceImage(null);
    setGeneratedVideoUrl(null);
    setStatus('IDLE');
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-16 px-6 font-sans">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-luxury-gold rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-luxury-gold rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-lg text-center mb-16 space-y-3 z-10">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-6xl font-serif font-medium tracking-tight text-luxury-charcoal"
        >
          LuxeMotion
        </motion.h1>
        <motion.div 
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="h-px w-12 bg-luxury-gold mx-auto"
        />
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-luxury-grey text-[10px] tracking-[0.4em] font-semibold uppercase pt-2"
        >
          Cinematic Product Motion
        </motion.p>
      </header>

      <main className="w-full max-w-md flex flex-col items-center flex-grow z-10">
        <AnimatePresence mode="wait">
          {status === 'IDLE' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full space-y-12"
            >
              <div 
                className="w-full video-stage border border-luxury-alabaster rounded-lg flex flex-col items-center justify-center p-4 transition-all duration-700 bg-luxury-alabaster shadow-2xl shadow-luxury-charcoal/5 group relative overflow-hidden"
                onClick={() => !sourceImage && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Thin dashed border overlay */}
                <div className="absolute inset-4 border border-dashed border-luxury-grey/20 rounded pointer-events-none group-hover:border-luxury-gold/40 transition-colors" />

                {sourceImage ? (
                  <div className="relative w-full h-full rounded overflow-hidden">
                    <img 
                      src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-luxury-charcoal/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="bg-white/90 backdrop-blur text-luxury-charcoal px-4 py-2 rounded text-[10px] uppercase tracking-widest font-bold shadow-lg"
                      >
                        Change Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-6 text-center px-8 relative z-10">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                      <Upload className="w-6 h-6 text-luxury-grey group-hover:text-luxury-gold transition-colors" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-luxury-charcoal font-medium tracking-tight text-lg">Upload Product Portrait</p>
                      <p className="text-luxury-grey text-[10px] uppercase tracking-widest">Minimalist background preferred for best results</p>
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              {sourceImage && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={generateVideo}
                  className="w-full bg-luxury-charcoal hover:bg-black text-white py-5 px-8 rounded flex items-center justify-center space-x-4 transition-all duration-500 shadow-2xl shadow-luxury-charcoal/20 group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-luxury-gold opacity-0 group-hover:opacity-10 transition-opacity" />
                  <Sparkles className="w-5 h-5 text-luxury-gold group-hover:scale-110 transition-transform" />
                  <span className="uppercase tracking-[0.2em] font-semibold text-[11px]">Generate Cinematic Promo</span>
                </motion.button>
              )}
            </motion.div>
          )}

          {status === 'API_KEY_REQUIRED' && (
            <motion.div 
              key="api-key"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full video-stage rounded-lg bg-luxury-alabaster flex flex-col items-center justify-center p-12 text-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white to-luxury-alabaster opacity-50" />
              <div className="relative z-10 flex flex-col items-center p-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-8">
                  <Key className="w-6 h-6 text-luxury-gold" />
                </div>
                <h2 className="text-2xl font-serif text-luxury-charcoal mb-4">Connect Agent Router</h2>
                <p className="text-luxury-grey text-xs mb-10 leading-relaxed uppercase tracking-widest text-center px-4">
                  High-fidelity video synthesis requires a verified AI Studio connection. No upfront costs apply.
                </p>
                <button
                  onClick={handleSelectApiKey}
                  className="w-full bg-luxury-charcoal hover:bg-black text-white py-4 rounded uppercase tracking-[0.2em] text-[10px] font-bold shadow-lg shadow-luxury-charcoal/10 transition-all mb-6"
                >
                  Confirm Connection
                </button>
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[9px] text-luxury-grey hover:text-luxury-gold uppercase tracking-widest transition-colors font-semibold"
                >
                  Billing Documentation
                </a>
              </div>
            </motion.div>
          )}

          {status === 'GENERATING' && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full video-stage rounded-lg bg-luxury-alabaster flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative mb-16">
                <div className="w-24 h-24 border border-luxury-gold/10 rounded-full animate-pulse-slow"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Sparkles className="w-8 h-8 text-luxury-gold" />
                  </motion.div>
                </div>
              </div>
              
              <div className="space-y-6 w-full max-w-[280px]">
                <h2 className="text-xl font-serif tracking-tight text-luxury-charcoal">Weaving Visual Elegance</h2>
                <div className="w-full h-px bg-luxury-grey/10 overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-luxury-gold shadow-[0_0_10px_rgba(197,160,89,0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute inset-0 bg-white/20"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-luxury-grey text-[9px] uppercase tracking-[0.4em] animate-pulse">Processing textures</p>
                </div>
              </div>

              <div className="mt-16 text-center space-y-1 opacity-40">
                <p className="text-[8px] text-luxury-grey tracking-widest uppercase">Refining hand shadows</p>
                <p className="text-[8px] text-luxury-grey tracking-widest uppercase italic">Cinematic focus lock</p>
              </div>
            </motion.div>
          )}

          {status === 'RESULT' && generatedVideoUrl && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-12"
            >
              <div className="w-full video-stage bg-black rounded-lg overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.15)] ring-1 ring-white/10 group relative">
                <video 
                  src={generatedVideoUrl} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 h-5 w-5 bg-black/40 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                </div>
              </div>

              <div className="flex flex-col space-y-4">
                <a
                  href={generatedVideoUrl}
                  download="LuxeMotion_Output.mp4"
                  className="w-full bg-luxury-charcoal text-white hover:bg-black py-5 rounded flex items-center justify-center space-x-3 transition-all duration-500 shadow-xl shadow-luxury-charcoal/10 active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span className="uppercase tracking-[0.2em] font-semibold text-[11px]">Export Cinematic MP4 (9:16)</span>
                </a>
                
                <button
                  onClick={reset}
                  className="w-full text-luxury-grey hover:text-luxury-charcoal py-4 flex items-center justify-center space-x-3 transition-colors group"
                >
                  <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-180 transition-transform duration-700" />
                  <span className="uppercase tracking-[0.1em] text-[10px] font-bold">New Creation</span>
                </button>
              </div>

              {sourceImage && (
                <div className="pt-16 border-t border-luxury-alabaster flex flex-col items-center">
                   <p className="text-[10px] text-luxury-grey uppercase tracking-[0.3em] font-semibold mb-6">Master Context</p>
                   <div className="w-24 aspect-[3/4] rounded-sm overflow-hidden opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-1000 ring-1 ring-luxury-grey/10 p-1 bg-white">
                     <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Reference" className="w-full h-full object-cover rounded-sm" />
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {status === 'ERROR' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full video-stage rounded-lg bg-red-50/30 flex flex-col items-center justify-center p-12 text-center"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-8 ring-1 ring-red-100">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-xl font-serif text-red-900 mb-4">Refinement Interrupted</h2>
              <p className="text-red-700/60 text-[10px] uppercase tracking-widest mb-10 max-w-[280px] leading-relaxed">{error}</p>
              <button
                onClick={() => setStatus('IDLE')}
                className="w-full bg-red-900/10 hover:bg-red-900/20 text-red-900 py-4 rounded uppercase tracking-[0.2em] text-[10px] font-bold transition-all"
              >
                Return to Studio
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Spacing and decoration */}
      <footer className="h-32 w-full flex items-center justify-center">
        <div className="text-luxury-grey/30 text-[9px] tracking-[0.5em] font-light uppercase">LuxeMotion Synthesis Engine v3.1</div>
      </footer>
      
      {/* Visual Accents */}
      <div className="fixed bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-luxury-gold/10 to-transparent opacity-50" />
    </div>
  );
}
