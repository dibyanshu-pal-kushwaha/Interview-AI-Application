export default function Home() {
  return (
    <div className="container" style={{ paddingTop: '6rem', paddingBottom: '6rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginBottom: '5rem' }} className="animate-fade-in">
        <h1 style={{ fontSize: '4rem', letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
          Master Your Next <br />
          <span className="text-gradient">Interview</span>
        </h1>
        <p className="text-muted" style={{ fontSize: '1.25rem', marginBottom: '2.5rem' }}>
          AI-powered mock interviews with voice, real-time scoring, ATS resume analysis, and detailed feedback.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/interview/new" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
            Start Interview
          </a>
          <a href="/dashboard" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
            View Dashboard
          </a>
        </div>
      </div>

      <div className="grid-3 animate-fade-in delay-2">
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎙️</div>
          <h3 style={{ fontSize: '1.25rem' }}>Voice Interviews</h3>
          <p className="text-muted">Real-time speech-to-text using Whisper and text-to-speech using gTTS for a natural interview experience.</p>
        </div>
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧠</div>
          <h3 style={{ fontSize: '1.25rem' }}>Hybrid Scoring Engine</h3>
          <p className="text-muted">Evaluated using BERTScore, semantic similarity, keyword matching, and Llama 3 for 4.0/5 relevance.</p>
        </div>
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📄</div>
          <h3 style={{ fontSize: '1.25rem' }}>ATS Resume Analysis</h3>
          <p className="text-muted">Upload your resume and the job description to generate 25+ role-specific questions.</p>
        </div>
      </div>
    </div>
  );
}
