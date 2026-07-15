'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/history')
        ]);
        
        if (statsRes.data.success) setStats(statsRes.data.data);
        if (historyRes.data.success) setHistory(historyRes.data.data.history);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <h2 className="text-muted">Loading your dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem' }}>Dashboard</h1>
        <a href="/interview/new" className="btn btn-primary">New Interview</a>
      </div>

      {stats && (
        <div className="grid-3 animate-fade-in" style={{ marginBottom: '4rem' }}>
          <StatCard title="Total Interviews" value={stats.totalInterviews} icon="📋" />
          <StatCard title="Average Score" value={`${Math.round(stats.averageScore || 0)}%`} icon="📈" />
          <StatCard title="Questions Answered" value={stats.totalQuestionsAnswered} icon="💬" />
        </div>
      )}

      <h2 style={{ marginBottom: '1.5rem' }} className="animate-fade-in delay-1">Recent Interviews</h2>
      
      {history.length === 0 ? (
        <div className="glass-panel animate-fade-in delay-2" style={{ padding: '3rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>You haven't completed any interviews yet.</p>
          <a href="/interview/new" className="btn btn-primary">Start Your First Interview</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in delay-2">
          {history.map((interview) => (
            <div key={interview.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{interview.jobRole}</h3>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {new Date(interview.createdAt).toLocaleDateString()} • {interview.status}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {interview.status === 'COMPLETED' && (
                  <div style={{ textAlign: 'right' }}>
                    <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Score</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {Math.round(interview.overallScore || 0)}
                    </div>
                  </div>
                )}
                <a href={interview.status === 'COMPLETED' ? `/interview/${interview.id}/report` : `/interview/${interview.id}`} className="btn btn-secondary">
                  {interview.status === 'COMPLETED' ? 'View Report' : 'Resume'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: string }) {
  return (
    <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <div style={{ fontSize: '2.5rem' }}>{icon}</div>
      <div>
        <h3 className="text-muted" style={{ fontSize: '0.875rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{title}</h3>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}
