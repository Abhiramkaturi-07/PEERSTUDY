import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Users, ArrowRight } from 'lucide-react';
import { SUBJECT_CATEGORIES } from '../constants';
import { useAuth } from '../App';

export default function SubjectSelection() {
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, number>>({});
  const [groupPreference, setGroupPreference] = useState(3);
  const [loading, setLoading] = useState(false);
  const { token, updateUser } = useAuth();
  const navigate = useNavigate();

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => {
      const next = { ...prev };
      if (next[subject] !== undefined) {
        delete next[subject];
      } else {
        next[subject] = 5; // Default score
      }
      return next;
    });
  };

  const updateScore = (subject: string, score: number) => {
    setSelectedSubjects(prev => ({ ...prev, [subject]: score }));
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedSubjects).length === 0) {
      alert("Please select at least one subject.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/subjects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subjects: selectedSubjects, groupPreference }),
      });
      if (res.ok) {
        updateUser({ group_preference: groupPreference });
        navigate('/match');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight mb-4">What are you studying?</h1>
        <p className="text-slate-500 text-lg">Select your subjects and rate your current proficiency level.</p>
      </div>

      <div className="grid gap-8">
        {Object.entries(SUBJECT_CATEGORIES).map(([category, subjects]) => (
          <div key={category} className="glass p-6 rounded-3xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-indigo-600 rounded-full"></span>
              {category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map(subject => {
                const isSelected = selectedSubjects[subject] !== undefined;
                return (
                  <div 
                    key={subject}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{subject}</span>
                      <button 
                        onClick={() => toggleSubject(subject)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check size={16} />}
                      </button>
                    </div>
                    
                    {isSelected && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2 pt-2 border-t border-indigo-200 dark:border-indigo-800"
                      >
                        <div className="flex justify-between text-xs font-medium text-slate-500">
                          <span>Weak</span>
                          <span>Strong</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="10"
                          value={selectedSubjects[subject]}
                          onChange={(e) => updateScore(subject, parseInt(e.target.value))}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="text-center font-bold text-indigo-600">{selectedSubjects[subject]} / 10</div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="glass p-8 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-bold">Preferred Group Size</h3>
              <p className="text-sm text-slate-500">How many members would you like in your group?</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {[2, 3, 4, 5].map(size => (
              <button
                key={size}
                onClick={() => setGroupPreference(size)}
                className={`w-12 h-12 rounded-xl font-bold transition-all ${
                  groupPreference === size 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading || Object.keys(selectedSubjects).length === 0}
            className="btn-primary flex items-center gap-2 text-lg px-10 py-4 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Find My Study Group'}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
