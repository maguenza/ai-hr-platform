import { useState, FormEvent, useEffect, useRef } from 'react';
import { FileText, Send, Loader2, CheckCircle, AlertCircle, Sparkles, TerminalSquare, FileDigit, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

interface ReportCard {
    match_score?: number;
    chosen_keywords?: string[];
    missing_keywords?: string[];
    error?: string;
    raw?: string;
}

export default function App() {
    const { user, signOut } = useAuth();

    const [url, setUrl] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);

    const [logs, setLogs] = useState<string[]>([]);
    const [report, setReport] = useState<ReportCard | null>(null);

    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Connect to SSE when jobId is set
    useEffect(() => {
        if (!jobId || status === 'error') return;

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const eventSource = new EventSource(`${API_URL}/api/stream-job/${jobId}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'log') {
                    setLogs(prev => [...prev, data.data]);
                } else if (data.type === 'complete') {
                    setReport(data.report || {});
                    setStatus('success');
                    eventSource.close();

                    // Automatically trigger download
                    if (data.filename) {
                        const dlLink = document.createElement('a');
                        dlLink.href = `${API_URL}/api/download-pdf/${jobId}`;
                        dlLink.download = data.filename;
                        document.body.appendChild(dlLink);
                        dlLink.click();
                        document.body.removeChild(dlLink);
                    }
                } else if (data.type === 'error') {
                    setErrorMessage(data.data || "Unknown error during streaming");
                    setStatus('error');
                    eventSource.close();
                }
            } catch (err) {
                console.error("SSE Parse logic error", err);
            }
        };

        eventSource.onerror = () => {
            setErrorMessage("Lost connection to server");
            setStatus('error');
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [jobId]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!url || !resumeFile) {
            setErrorMessage("Please provide both a Job URL and your base Resume PDF.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMessage('');
        setLogs([]);
        setReport(null);
        setJobId(null);

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        try {
            // Get current JWT for backend auth
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const formData = new FormData();
            formData.append('url', url);
            formData.append('resume', resumeFile);

            const response = await fetch(`${API_URL}/api/start-optimization`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    // Do not set Content-Type, fetch will automatically set it to multipart/form-data with the correct boundary
                },
                body: formData
            });

            if (!response.ok) {
                let errorMsg = "Failed to start optimization job.";
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch {
                    errorMsg = `Server error: ${response.statusText}`;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            setJobId(data.job_id);
        } catch (err: any) {
            setErrorMessage(err.message);
            setStatus('error');
        }
    };

    const getGridCols = () => {
        if (status === 'success') return 'grid-cols-1 lg:grid-cols-3';
        if (status === 'loading') return 'grid-cols-1 lg:grid-cols-2';
        return 'grid-cols-1 max-w-2xl mx-auto';
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-x-hidden transition-all duration-700">

            {/* User Bar */}
            <div className="absolute top-6 right-6 z-20 flex items-center gap-4 bg-slate-900/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-lg">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <UserIcon className="w-4 h-4 text-blue-400" />
                    <span className="truncate max-w-[150px]">{user?.email}</span>
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                <button
                    onClick={signOut}
                    className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </div>

            {/* Background blobs for premium feel */}
            <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-500/10 blur-[120px] mix-blend-screen pointer-events-none"></div>

            <div className={`w-full max-w-7xl z-10 grid gap-8 transition-all duration-700 mt-12 ${getGridCols()}`}>

                {/* Box 1: Form Input */}
                <div className="glass-card flex flex-col justify-center rounded-2xl p-8 transition-all h-full min-h-[400px]">
                    <header className="text-center mb-10">
                        <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-xl mb-6 ring-1 ring-white/10 shadow-xl">
                            <Sparkles className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-white drop-shadow-sm">
                            AI Resume <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Optimizer</span>
                        </h1>
                        <p className="text-slate-300 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                            Tailor your resume against any live job description.
                        </p>
                    </header>

                    <form onSubmit={handleSubmit} className="mb-4">
                        <div className="flex flex-col gap-4">
                            <label htmlFor="url" className="text-sm font-medium text-slate-300 ml-1">
                                Job Description URL
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <input
                                    type="url"
                                    id="url"
                                    name="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://jobs.lever.co/..."
                                    required
                                    autoComplete="off"
                                    disabled={status === 'loading' || status === 'success'}
                                    className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-inner"
                                />
                            </div>

                            <label htmlFor="resume" className="text-sm font-medium text-slate-300 ml-1 mt-2">
                                Base Resume (PDF)
                            </label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    id="resume"
                                    accept=".pdf"
                                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                    required
                                    disabled={status === 'loading' || status === 'success'}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner cursor-pointer"
                                />
                            </div>

                            <label htmlFor="resume" className="text-sm font-medium text-slate-300 ml-1 mt-2">
                                Base Resume (PDF)
                            </label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    id="resume"
                                    accept=".pdf"
                                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                    required
                                    disabled={status === 'loading' || status === 'success'}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner cursor-pointer"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading' || status === 'success'}
                                className="mt-2 w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-80 disabled:cursor-not-allowed transition-all group"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Agents are working...</span>
                                    </>
                                ) : status === 'success' ? (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        <span>Completed!</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Generate CV</span>
                                        <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {status === 'error' && (
                        <div className="mt-4 flex gap-4 text-rose-300 bg-rose-500/10 p-5 rounded-xl border border-rose-500/20">
                            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-medium mb-1">Pipeline Failed</h3>
                                <p className="text-sm opacity-90">{errorMessage}</p>
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <button onClick={() => { setStatus('idle'); setUrl(''); setJobId(null); setReport(null); setLogs([]); }} className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors w-full text-center">
                            Start a new job
                        </button>
                    )}

                </div>

                {/* Box 2: Real-time Terminal Logs */}
                {(status === 'loading' || status === 'success' || (status === 'error' && logs.length > 0)) && (
                    <div className="glass-card flex flex-col rounded-2xl p-6 h-full max-h-[600px] animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center gap-3 mb-4 text-slate-300 border-b border-white/10 pb-4">
                            <TerminalSquare className="w-5 h-5 text-purple-400" />
                            <h2 className="font-semibold tracking-wide uppercase text-sm">Agent Activity Log</h2>
                            {status === 'loading' && <Loader2 className="w-4 h-4 ml-auto animate-spin text-blue-400" />}
                        </div>

                        <div className="flex-1 overflow-y-auto font-mono text-xs md:text-sm text-slate-300 bg-slate-950/50 rounded-lg p-4 custom-scrollbar whitespace-pre-wrap leading-relaxed">
                            {logs.length === 0 && status === 'loading' && (
                                <span className="opacity-50 italic">Waiting for agents to assemble...</span>
                            )}
                            {logs.map((log, idx) => (
                                <span key={idx} className={`${log.toLowerCase().includes('error') ? 'text-rose-400' : ''}`}>{log}</span>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {/* Box 3: Evaluation Report Card */}
                {status === 'success' && (
                    <div className="glass-card flex flex-col rounded-2xl p-6 h-full max-h-[600px]  animate-in slide-in-from-right-8 duration-700">
                        <div className="flex items-center gap-3 mb-4 text-emerald-300 border-b border-white/10 pb-4">
                            <FileDigit className="w-5 h-5" />
                            <h2 className="font-semibold tracking-wide uppercase text-sm">Evaluation Report</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">

                            {/* Match Score */}
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 rounded-xl border border-white/5">
                                <span className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">JD Match Score</span>
                                <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-cyan-400">
                                    {report?.match_score || '-'} <span className="text-2xl opacity-50">/100</span>
                                </div>
                            </div>

                            {/* Report Details */}
                            {report?.error || report?.raw ? (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl">
                                    <p className="text-sm text-rose-300">Could not parse JSON report properly. Raw Output:</p>
                                    <pre className="mt-2 text-xs font-mono text-slate-400 bg-black/30 p-2 rounded whitespace-pre-wrap">{report.raw || report.error}</pre>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Keywords Injected
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {report?.chosen_keywords?.map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-200">
                                                    {kw}
                                                </span>
                                            )) || <span className="text-slate-500 italic text-xs">None</span>}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-rose-400 mb-3 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> Missing Keywords
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {report?.missing_keywords?.map((kw, i) => (
                                                <span key={i} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-xs text-rose-200">
                                                    {kw}
                                                </span>
                                            )) || <span className="text-slate-500 italic text-xs">None</span>}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
