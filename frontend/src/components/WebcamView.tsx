'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function WebcamView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false, // Audio is handled by AudioRecorder
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsActive(true);
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setError('Camera access denied or unavailable. Please enable camera permissions to continue.');
      }
    };

    startWebcam();

    return () => {
      // Cleanup: stop all video tracks when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      backgroundColor: '#000',
      borderRadius: '1rem',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      {error ? (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--danger)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        }}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror effect
              opacity: isActive ? 1 : 0,
              transition: 'opacity 0.5s ease'
            }}
          />
          {!isActive && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              Loading camera...
            </div>
          )}
          
          {/* Recording indicator overlay */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '0.25rem 0.75rem',
            borderRadius: '2rem',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger)',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Live</span>
          </div>
        </>
      )}
    </div>
  );
}
