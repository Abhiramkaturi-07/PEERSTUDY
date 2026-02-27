import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, BookOpen, Target, Edit3, Save, X, Star } from 'lucide-react';
import { useAuth } from '../App';
import { UserSubject } from '../types';
import { BRANCHES, SUBJECT_CATEGORIES } from '../constants';

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    branch: user?.branch || '',
    goals: user?.goals || '',
    group_preference: user?.group_preference || 3
  });
  const [subjects, setSubjects] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.subjects) {
      const subMap: Record<string, number> = {};
      user.subjects.forEach(s => {
        subMap[s.subject_name] = s.score;
      });
      setSubjects(subMap);
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // In a real app, we'd have a specific profile update endpoint
      // For this demo, we'll reuse the subjects endpoint for skills and preference
      const res = await fetch('/api/user/subjects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subjects, groupPreference: formData.group_preference }),
      });
      
      if (res.ok) {
        const updatedSubjects = Object.entries(subjects).map(([name, score]) => ({ subject_name: name, score }));
        updateUser({ 
          ...formData, 
          subjects: updatedSubjects 
        });
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Basic Info */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="glass p-8 rounded-[2.5rem] text-center">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-bold shadow-2xl shadow-indigo-500/30">
                {user.name[0]}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full"></div>
            </div>
            
            {isEditing ? (
              <div className="space-y-4 text-left">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Name</label>
                  <input 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Branch</label>
                  <select 
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="input-field py-2"
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-1">{user.name}</h2>
                <p className="text-slate-500 font-medium mb-6">{user.branch}</p>
                <div className="flex justify-center gap-4">
                  <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">Group Size</p>
                    <p className="font-bold">{user.group_preference}</p>
                  </div>
                  <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-[10px] font-bold text-purple-600 uppercase">Subjects</p>
                    <p className="font-bold">{user.subjects?.length || 0}</p>
                  </div>
                </div>
              </>
            )}

            <button 
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={loading}
              className={`w-full mt-8 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                isEditing ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
              }`}
            >
              {isEditing ? (
                <><Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}</>
              ) : (
                <><Edit3 size={18} /> Edit Profile</>
              )}
            </button>
            {isEditing && (
              <button 
                onClick={() => setIsEditing(false)}
                className="w-full mt-2 py-2 text-slate-400 text-sm font-bold hover:text-slate-600"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="glass p-8 rounded-[2.5rem]">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Target size={16} className="text-indigo-600" />
              Learning Goals
            </h3>
            {isEditing ? (
              <textarea 
                value={formData.goals}
                onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                className="input-field min-h-[150px] text-sm"
              />
            ) : (
              <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
                "{user.goals || "No goals specified yet. Add some to help others understand your focus!"}"
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Skills */}
        <div className="flex-1 space-y-6">
          <div className="glass p-8 rounded-[2.5rem]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <BookOpen className="text-indigo-600" />
                Subject Proficiency
              </h3>
              {!isEditing && (
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star size={20} fill="currentColor" />
                  <span>Top Performer</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-8">
              {Object.entries(SUBJECT_CATEGORIES).map(([category, categorySubjects]) => {
                const activeSubjects = categorySubjects.filter(s => subjects[s] !== undefined);
                if (activeSubjects.length === 0 && !isEditing) return null;

                return (
                  <div key={category}>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{category}</h4>
                    <div className="space-y-6">
                      {categorySubjects.map(subject => {
                        const score = subjects[subject];
                        if (score === undefined && !isEditing) return null;

                        return (
                          <div key={subject} className="group">
                            <div className="flex justify-between items-center mb-2">
                              <span className={`font-bold ${score === undefined ? 'text-slate-300' : ''}`}>{subject}</span>
                              {score !== undefined && (
                                <span className={`text-sm font-bold ${score > 7 ? 'text-emerald-500' : score < 4 ? 'text-rose-500' : 'text-indigo-500'}`}>
                                  {score}/10
                                </span>
                              )}
                            </div>
                            
                            {isEditing ? (
                              <div className="flex items-center gap-4">
                                <input 
                                  type="checkbox"
                                  checked={score !== undefined}
                                  onChange={() => {
                                    setSubjects(prev => {
                                      const next = { ...prev };
                                      if (next[subject] !== undefined) delete next[subject];
                                      else next[subject] = 5;
                                      return next;
                                    });
                                  }}
                                  className="w-5 h-5 rounded-lg accent-indigo-600"
                                />
                                {score !== undefined && (
                                  <input 
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={score}
                                    onChange={(e) => setSubjects({ ...subjects, [subject]: parseInt(e.target.value) })}
                                    className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(score || 0) * 10}%` }}
                                  className={`h-full rounded-full ${score! > 7 ? 'bg-emerald-500' : score! < 4 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
