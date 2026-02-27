import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Star, X, Check, ArrowRight, User as UserIcon, Info } from 'lucide-react';
import { useAuth } from '../App';
import { Recommendation, UserSubject } from '../types';

export default function MatchingPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [viewingUser, setViewingUser] = useState<Recommendation | null>(null);
  const { token, updateUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/match', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setRecommendations(data);
      setLoading(false);
    });
  }, [token]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleJoinGroup = async () => {
    if (selectedIds.length === 0) return;
    setJoining(true);
    try {
      const res = await fetch('/api/groups/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberIds: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        updateUser({ group_id: data.groupId });
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Analyzing compatibility...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">Recommended Peers</h1>
          <p className="text-slate-500 text-lg">We've found students who complement your strengths and weaknesses.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-indigo-600">{selectedIds.length} Selected</p>
            <p className="text-xs text-slate-500">Form your ideal group</p>
          </div>
          <button
            onClick={handleJoinGroup}
            disabled={selectedIds.length === 0 || joining}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Form Group'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="glass p-12 rounded-3xl text-center">
          <Users size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-bold mb-2">No matches found yet</h3>
          <p className="text-slate-500">Try updating your skills or check back later as more students join.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((rec) => (
            <motion.div
              layout
              key={rec.id}
              className={`glass rounded-3xl overflow-hidden border-2 transition-all cursor-pointer group ${
                selectedIds.includes(rec.id) ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-transparent'
              }`}
              onClick={() => toggleSelect(rec.id)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 transition-colors">
                    <UserIcon size={28} />
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star size={16} fill="currentColor" />
                      <span>{rec.compatibility}%</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Match Score</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-1">{rec.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{rec.branch}</p>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Strong In</p>
                  <div className="flex flex-wrap gap-2">
                    {rec.strongestSubjects.slice(0, 3).map(s => (
                      <span key={s} className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full">
                        {s}
                      </span>
                    ))}
                    {rec.strongestSubjects.length > 3 && (
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold rounded-full">
                        +{rec.strongestSubjects.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingUser(rec);
                    }}
                    className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline"
                  >
                    <Info size={16} />
                    View Profile
                  </button>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    selectedIds.includes(rec.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'
                  }`}>
                    <Check size={18} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* User Profile Modal */}
      <AnimatePresence>
        {viewingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setViewingUser(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="p-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white">
                    <UserIcon size={48} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-1">{viewingUser.name}</h2>
                    <p className="text-slate-500 font-medium">{viewingUser.branch}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="px-3 py-1 bg-amber-100 text-amber-600 text-xs font-bold rounded-full flex items-center gap-1">
                        <Star size={12} fill="currentColor" />
                        {viewingUser.compatibility}% Compatibility
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Subject Stats</h3>
                    <div className="space-y-4">
                      {viewingUser.allSubjects.map(s => (
                        <div key={s.subject_name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{s.subject_name}</span>
                            <span className="font-bold text-indigo-600">{s.score}/10</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${s.score * 10}%` }}
                              className={`h-full rounded-full ${s.score > 7 ? 'bg-emerald-500' : s.score < 4 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Learning Goals</h3>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl italic text-slate-600 dark:text-slate-400">
                      "{viewingUser.goals || "No goals specified yet."}"
                    </div>
                    
                    <div className="mt-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Group Preference</h3>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                          {viewingUser.group_preference}
                        </div>
                        <span className="text-sm font-medium">Members preferred</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex justify-end">
                  <button 
                    onClick={() => {
                      toggleSelect(viewingUser.id);
                      setViewingUser(null);
                    }}
                    className={`px-8 py-3 rounded-xl font-bold transition-all ${
                      selectedIds.includes(viewingUser.id)
                        ? 'bg-rose-500 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {selectedIds.includes(viewingUser.id) ? 'Deselect User' : 'Select for Group'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
