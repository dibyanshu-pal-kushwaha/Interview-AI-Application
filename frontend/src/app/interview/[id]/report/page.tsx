'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export default function ReportPage() {
  const params = useParams();
  const interviewId = params.id as string;
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get(`/interviews/${interviewId}/report`);
        if (res.data.success) {
          setReport(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load report:', err);
        alert('Failed to load interview report.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [interviewId]);

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <h2 className="text-muted">Analyzing your performance...</h2>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
        <div>
          <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Interview Report</h1>
          <p className="text-muted">{report.jobRole} Role Assessment</p>
        </div>
        <a href="/dashboard" className="btn btn-secondary">Back to Dashboard</a>
      </div>

      <div className="grid-3 animate-fade-in" style={{ marginBottom: '4rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 className="text-muted" style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Score</h3>
          <div style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--accent-primary)', lineHeight: 1 }}>
            {report.overallScore}<span style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>/100</span>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '2rem', gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: '1rem' }}>Feedback Summary</h3>
          <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{report.summary || "Detailed AI feedback will be provided here based on your overall performance across all questions."}</p>
        </div>
      </div>

      <div className="grid-3 animate-fade-in delay-1" style={{ marginBottom: '4rem', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', borderTop: '3px solid var(--danger)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span> Areas Missed / Lagged
          </h3>
          <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            {(report.scoreBreakdown?.missedAreas || []).map((area: string, i: number) => (
              <li key={i}>{area}</li>
            ))}
            {(!report.scoreBreakdown?.missedAreas || report.scoreBreakdown.missedAreas.length === 0) && (
              <li>No major concepts missed. Great job!</li>
            )}
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', borderTop: '3px solid var(--warning)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🗣️</span> Speaking Flaws
          </h3>
          <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            {(report.scoreBreakdown?.speakingFlaws || []).map((flaw: string, i: number) => (
              <li key={i}>{flaw}</li>
            ))}
            {(!report.scoreBreakdown?.speakingFlaws || report.scoreBreakdown.speakingFlaws.length === 0) && (
              <li>Communication was clear and structured.</li>
            )}
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', borderTop: '3px solid var(--success)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💡</span> Actionable Tips
          </h3>
          <ul style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-secondary)' }}>
            {(report.scoreBreakdown?.tips || []).map((tip: string, i: number) => (
              <li key={i}>{tip}</li>
            ))}
            {(!report.scoreBreakdown?.tips || report.scoreBreakdown.tips.length === 0) && (
              <li>Keep doing what you're doing!</li>
            )}
          </ul>
        </div>
      </div>

      <h2 style={{ marginBottom: '2rem' }} className="animate-fade-in delay-2">Question Analysis</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="animate-fade-in delay-2">
        {report.questionResults.map((q: any, index: number) => (
          <div key={q.questionId} className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', maxWidth: '80%' }}>
                <span className="text-gradient">Q{index + 1}.</span> {q.title}
              </h3>
              <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)', padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                {q.score?.overallScore || 0}/100
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
              <div>
                <h4 className="text-muted" style={{ fontSize: '0.875rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Your Answer</h4>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.95rem' }}>
                  {q.answerText || "No answer provided"}
                </div>
              </div>
              <div>
                <h4 className="text-muted" style={{ fontSize: '0.875rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Question Context</h4>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.95rem' }}>
                  {q.description}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <ScorePill label="Semantic Match" score={Math.round((q.score?.semanticScore || 0) * 100)} />
              <ScorePill label="BERT F1" score={Math.round((q.score?.bertScore || 0) * 100)} />
              <ScorePill label="Keyword Match" score={Math.round((q.score?.keywordScore || 0) * 100)} />
              <ScorePill label="Time Taken" value={`${q.timeTakenSecs || 0}s`} isNeutral />
            </div>
            
            {q.score?.feedback && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', borderLeft: '3px solid var(--accent-secondary)', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                <strong>AI Feedback: </strong> {q.score.feedback}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorePill({ label, score, value, isNeutral }: { label: string, score?: number, value?: string, isNeutral?: boolean }) {
  const displayValue = value || `${score}%`;
  
  let colorClass = 'var(--text-secondary)';
  if (!isNeutral && score !== undefined) {
    if (score >= 80) colorClass = 'var(--success)';
    else if (score >= 60) colorClass = 'var(--warning)';
    else colorClass = 'var(--danger)';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.875rem' }}>
      <span className="text-muted">{label}:</span>
      <strong style={{ color: colorClass }}>{displayValue}</strong>
    </div>
  );
}
