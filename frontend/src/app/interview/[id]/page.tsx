'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import api from '@/lib/api';
import AudioRecorder from '@/components/AudioRecorder';
import WebcamView from '@/components/WebcamView';

export default function ActiveInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transcribedText, setTranscribedText] = useState('');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const startTimeRef = useRef<number>(Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchInterview();
  }, [interviewId]);

  const fetchInterview = async () => {
    try {
      const res = await api.get(`/interviews/${interviewId}`);
      if (res.data.success) {
        const data = res.data.data;
        setInterview(data);
        
        if (data.status === 'COMPLETED') {
          router.push(`/interview/${interviewId}/report`);
          return;
        }

        // Find the first unanswered question
        const nextQ = data.interviewQuestions.find((iq: any) => !iq.answer);
        if (nextQ) {
          setCurrentQuestion(nextQ);
          startTimeRef.current = Date.now();
          playQuestionAudio(nextQ.question.title);
        } else {
          router.push(`/interview/${interviewId}/report`);
        }
      }
    } catch (err) {
      console.error('Error fetching interview:', err);
      alert('Failed to load interview.');
    } finally {
      setIsLoading(false);
    }
  };

  const playQuestionAudio = async (text: string) => {
    try {
      const res = await api.post('/voice/synthesize', { text });
      if (res.data.success && res.data.data.audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(`http://localhost:4000${res.data.data.audioUrl}`);
        audioRef.current = audio;
        audio.play();
      }
    } catch (err) {
      console.error('Failed to synthesize audio', err);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsProcessingAudio(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'answer.webm');

      // Use raw axios to prevent api instance defaults
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/voice/transcribe`, formData, {
        headers: { 'Content-Type': undefined },
      });

      if (res.data.success) {
        setTranscribedText(res.data.data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const submitAnswer = async () => {
    if (!transcribedText.trim()) return;

    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await api.post(`/interviews/${interviewId}/answer`, {
        interviewQuestionId: currentQuestion.id,
        answerText: transcribedText,
        timeTakenSecs: timeTaken,
      });

      if (res.data.success) {
        setTranscribedText('');
        if (res.data.data.interviewCompleted) {
          router.push(`/interview/${interviewId}/report`);
        } else {
          // Refresh interview to get next question
          await fetchInterview();
        }
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      alert('Failed to submit answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <h2 className="text-muted">Loading interview...</h2>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const currentQIndex = interview?.interviewQuestions.findIndex((iq: any) => iq.id === currentQuestion.id) + 1;
  const totalQs = interview?.interviewQuestions.length;

  return (
    <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 className="text-gradient">Question {currentQIndex} of {totalQs}</h2>
          <span className="text-muted" style={{ fontFamily: 'var(--font-mono)' }}>{interview?.jobRole}</span>
        </div>

        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '600px' }}>
            <WebcamView />
          </div>
        </div>

        <div className="glass-panel animate-fade-in" style={{ padding: '3rem', textAlign: 'center', marginBottom: '2rem', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1.75rem', fontWeight: 500, lineHeight: 1.4 }}>
            "{currentQuestion.question.title}"
          </h3>
        </div>

        {!transcribedText ? (
          <div className="glass-panel animate-fade-in delay-1" style={{ padding: '2rem' }}>
            <h4 style={{ textAlign: 'center', marginBottom: '1rem' }}>Record Your Answer</h4>
            <AudioRecorder onRecordingComplete={handleRecordingComplete} isProcessing={isProcessingAudio} />
          </div>
        ) : (
          <div className="glass-panel animate-fade-in delay-1" style={{ padding: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Review Your Answer</span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                onClick={() => setTranscribedText('')}
              >
                Re-record
              </button>
            </h4>
            <textarea
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--glass-border)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '1.125rem',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
                resize: 'vertical'
              }}
            />
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }}
              onClick={submitAnswer}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting & Scoring...' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
