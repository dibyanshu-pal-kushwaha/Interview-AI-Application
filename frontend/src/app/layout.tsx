import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Mock Interview Agent | Master Your Next Interview",
  description: "AI-powered mock interviews with voice, real-time scoring, and detailed feedback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.png" alt="Interview AI Logo" style={{ height: '32px', width: 'auto' }} />
            <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.25rem' }}>Interview AI</span>
          </div>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <a href="/" className="text-muted" style={{ fontWeight: 500 }}>Home</a>
            <a href="/dashboard" className="text-muted" style={{ fontWeight: 500 }}>Dashboard</a>
            <a href="/interview/new" className="text-muted" style={{ fontWeight: 500 }}>New Interview</a>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
