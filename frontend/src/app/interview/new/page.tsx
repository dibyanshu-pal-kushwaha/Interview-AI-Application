'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewInterviewPage() {
  const router = useRouter();
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setError('Please upload your resume');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('jobRole', jobRole);
      formData.append('jobDescription', jobDescription);
      formData.append('resume', resumeFile);

      const response = await api.post('/interviews', formData);

      if (response.data.success && response.data.data.interview?.id) {
        // Redirect to the active interview room
        router.push(`/interview/${response.data.data.interview.id}`);
      } else {
        setError('Failed to create interview. Please try again.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.response?.data?.error?.message || 'An unexpected error occurred while generating questions.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
          Configure Your Interview
        </h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          Our AI will analyze your resume against the job description to generate targeted questions.
        </p>

        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2.5rem' }}>
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="jobRole" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Job Role / Title
            </label>
            <input
              type="text"
              id="jobRole"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="jobDescription" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Job Description
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              required
              rows={6}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <label htmlFor="resume" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Upload Resume (PDF)
            </label>
            <input
              type="file"
              id="resume"
              accept=".pdf"
              onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
              required
              style={{ ...inputStyle, padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? 'Generating Interview...' : 'Start Interview'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--glass-border)',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};
