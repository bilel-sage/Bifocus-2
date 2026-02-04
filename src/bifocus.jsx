import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Play, Pause, X, Plus, Check, Clock, Zap, Battery, Moon, Sun, BarChart3, Target, Eye, Calendar, ChevronRight, Edit2, Trash2, Circle, CheckCircle2, PlayCircle } from 'lucide-react';

// Timer Context - Complètement isolé
const TimerContext = createContext(null);

const TimerProvider = ({ children }) => {
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showFloatingTimer, setShowFloatingTimer] = useState(false);
  const timerIntervalRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const value = {
    activeTimer,
    timerRemaining,
    timerRunning,
    showFloatingTimer,
    setActiveTimer,
    setTimerRemaining,
    setTimerRunning,
    setShowFloatingTimer,
    timerIntervalRef
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};

// Composant Timer isolé pour éviter le re-render de toute l'app
const TimerDisplay = React.memo(({ time }) => {
  return (
    <div className="timer-time">
      {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
    </div>
  );
});

// Timer Manager - Gère toute la logique du timer sans toucher BiFocus
const TimerManager = ({ onTimerComplete }) => {
  const {
    activeTimer,
    timerRemaining,
    timerRunning,
    setTimerRemaining,
    setTimerRunning,
    setActiveTimer,
    setShowFloatingTimer,
    timerIntervalRef
  } = useTimer();

  useEffect(() => {
    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Only start interval if timer is running
    if (timerRunning && timerRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemaining(prev => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            
            setTimeout(() => {
              if (onTimerComplete && activeTimer) {
                onTimerComplete(activeTimer);
              }
              setActiveTimer(null);
              setTimerRemaining(0);
              setTimerRunning(false);
              setShowFloatingTimer(false);
            }, 0);
            
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timerRunning, timerRemaining > 0]);

  return null; // Ce composant ne render rien
};

// TaskCard mémorisé
const TaskCard = React.memo(({ task, onUpdate, onDelete, onEdit }) => {
  const energyColors = {
    low: '#4ade80',
    medium: '#fbbf24',
    high: '#f87171'
  };

  return (
    <div className={`task-card ${task.status} ${task.priority === 'critical' ? 'critical' : ''}`}>
      <div className="task-header">
        <button 
          type="button"
          className="task-status-btn"
          onClick={() => onUpdate(task.id, { 
            status: task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in-progress' : 'done'
          })}
        >
          {task.status === 'done' ? <CheckCircle2 size={20} /> : 
           task.status === 'in-progress' ? <PlayCircle size={20} /> : 
           <Circle size={20} />}
        </button>
        
        <div className="task-content">
          <h3>{task.title}</h3>
          {task.description && <p className="task-description">{task.description}</p>}
        </div>

        <div className="task-actions">
          <button type="button" onClick={() => onEdit(task)} className="icon-btn">
            <Edit2 size={16} />
          </button>
          <button type="button" onClick={() => onDelete(task.id)} className="icon-btn">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="task-meta">
        {task.startTime && task.endTime && (
          <span className="meta-item">
            <Clock size={14} />
            {task.startTime} - {task.endTime}
          </span>
        )}
        <span className="meta-item">
          <Zap size={14} />
          {task.estimatedMinutes} min
        </span>
        <span className="meta-item" style={{ color: energyColors[task.energy] }}>
          <Battery size={14} />
          {task.energy === 'low' ? 'Basse' : task.energy === 'medium' ? 'Moyenne' : 'Haute'}
        </span>
      </div>
    </div>
  );
});

// Floating Timer Component - Complètement isolé avec contexte
const FloatingTimer = React.memo(({ onPause, onResume, onStop }) => {
  const { activeTimer, timerRemaining, timerRunning, showFloatingTimer } = useTimer();
  
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('bifocus-timer-position');
    return saved ? JSON.parse(saved) : { bottom: 20, right: 20 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

  // Sauvegarder la position
  useEffect(() => {
    localStorage.setItem('bifocus-timer-position', JSON.stringify(position));
  }, [position]);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.floating-timer-controls') || e.target.closest('.floating-timer-minimize')) return;
    
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.clientX - (window.innerWidth - position.right);
    dragRef.current.startY = e.clientY - (window.innerHeight - position.bottom);
    setIsDragging(true);
    
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return;
    
    const newRight = window.innerWidth - e.clientX + dragRef.current.startX;
    const newBottom = window.innerHeight - e.clientY + dragRef.current.startY;
    
    setPosition({
      right: Math.max(0, Math.min(window.innerWidth - 200, newRight)),
      bottom: Math.max(0, Math.min(window.innerHeight - 100, newBottom))
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!showFloatingTimer || !activeTimer) return null;

  return (
    <div 
      className={`floating-timer ${isDragging ? 'dragging' : ''} ${isMinimized ? 'minimized' : ''}`}
      style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="floating-timer-header">
        <span className="floating-timer-type">
          {activeTimer.type?.includes('eye-rest') ? '👁️' : '⏱️'}
        </span>
        <button 
          type="button"
          className="floating-timer-minimize"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(!isMinimized);
          }}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
      
      {!isMinimized && (
        <>
          <TimerDisplay time={timerRemaining} />
          
          <div className="floating-timer-controls">
            {timerRunning ? (
              <button type="button" onClick={onPause} className="floating-btn">
                <Pause size={14} />
              </button>
            ) : (
              <button type="button" onClick={onResume} className="floating-btn">
                <Play size={14} />
              </button>
            )}
            <button type="button" onClick={onStop} className="floating-btn stop">
              <X size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

// TimerPanel mémorisé utilisant le contexte
const TimerPanel = React.memo(({ onStartTimer, onPauseTimer, onResumeTimer, onStopTimer }) => {
  const { activeTimer, timerRemaining, timerRunning, showFloatingTimer } = useTimer();
  
  const timerButtons = [
    { duration: 25, type: 'focus-25', label: '25 min', subtitle: 'Focus court', icon: Target },
    { duration: 50, type: 'focus-50', label: '50 min', subtitle: 'Deep work', icon: Zap },
    { duration: 120, type: 'deep-work-120', label: '2h', subtitle: 'Focus long', icon: BarChart3 },
    { duration: 5, type: 'eye-rest-5', label: '5 min', subtitle: 'Repos yeux', icon: Eye },
    { duration: 10, type: 'eye-rest-10', label: '10 min', subtitle: 'Repos yeux', icon: Eye },
  ];

  return (
    <div className="timer-panel">
      <h2>Timers de productivité</h2>
      <div className="timer-grid">
        {timerButtons.map(timer => (
          <button
            key={timer.type}
            type="button"
            onClick={() => onStartTimer(timer.duration, timer.type)}
            className={`timer-btn ${activeTimer?.type === timer.type ? 'active' : ''}`}
            disabled={activeTimer !== null}
          >
            <timer.icon size={24} />
            <div className="timer-label">
              <span className="timer-duration">{timer.label}</span>
              <span className="timer-subtitle">{timer.subtitle}</span>
            </div>
          </button>
        ))}
      </div>

      {activeTimer && !showFloatingTimer && (
        <div className="active-timer">
          <div className="timer-display">
            <TimerDisplay time={timerRemaining} />
            <div className="timer-label-small">{activeTimer.type.replace(/-/g, ' ')}</div>
          </div>
          
          <div className="timer-progress">
            <div 
              className="timer-progress-bar"
              style={{ width: `${(timerRemaining / (activeTimer.duration * 60)) * 100}%` }}
            />
          </div>

          <div className="timer-controls">
            {timerRunning ? (
              <button type="button" onClick={onPauseTimer} className="btn-secondary">
                <Pause size={16} /> Pause
              </button>
            ) : (
              <button type="button" onClick={onResumeTimer} className="btn-primary">
                <Play size={16} /> Reprendre
              </button>
            )}
            <button type="button" onClick={onStopTimer} className="btn-danger">
              <X size={16} /> Arrêter
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

const BiFocus = () => {
  // Utiliser le contexte Timer au lieu des states locaux
  const {
    activeTimer,
    setActiveTimer,
    setTimerRemaining,
    setTimerRunning,
    setShowFloatingTimer
  } = useTimer();

  const [activeSpace, setActiveSpace] = useState('pro');
  const [activeView, setActiveView] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [deepWorkMode, setDeepWorkMode] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [dailyPriorities, setDailyPriorities] = useState([]);
  const [showRitualStart, setShowRitualStart] = useState(false);
  const [showRitualEnd, setShowRitualEnd] = useState(false);
  const [stats, setStats] = useState({ focusTime: 0, tasksCompleted: 0, breaks: 0 });
  const [editingTask, setEditingTask] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [activeSpace]);

  const loadData = async () => {
    try {
      const tasksKey = `tasks-${activeSpace}`;
      const statsKey = `stats-${activeSpace}`;
      const prioritiesKey = `priorities-${activeSpace}`;
      
      const [tasksResult, statsResult, prioritiesResult] = await Promise.all([
        window.storage.get(tasksKey).catch(() => null),
        window.storage.get(statsKey).catch(() => null),
        window.storage.get(prioritiesKey).catch(() => null)
      ]);

      if (tasksResult?.value) setTasks(JSON.parse(tasksResult.value));
      if (statsResult?.value) setStats(JSON.parse(statsResult.value));
      if (prioritiesResult?.value) setDailyPriorities(JSON.parse(prioritiesResult.value));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async (newTasks = tasks, newStats = stats, newPriorities = dailyPriorities) => {
    try {
      await Promise.all([
        window.storage.set(`tasks-${activeSpace}`, JSON.stringify(newTasks)),
        window.storage.set(`stats-${activeSpace}`, JSON.stringify(newStats)),
        window.storage.set(`priorities-${activeSpace}`, JSON.stringify(newPriorities))
      ]);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Timer management - Simplifié avec le contexte
  const startTimer = useCallback((duration, type) => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setActiveTimer({ duration, type, startTime: Date.now() });
    setTimerRemaining(duration * 60);
    setTimerRunning(true);
    setShowFloatingTimer(true);
    
    if (type !== 'eye-rest-5' && type !== 'eye-rest-10') {
      if (type === 'deep-work-120') setDeepWorkMode(true);
    }
  }, [setActiveTimer, setTimerRemaining, setTimerRunning, setShowFloatingTimer]);

  const pauseTimer = useCallback(() => {
    setTimerRunning(false);
  }, [setTimerRunning]);

  const resumeTimer = useCallback(() => {
    setTimerRunning(true);
  }, [setTimerRunning]);

  const stopTimer = useCallback(async (completed = false) => {
    if (completed && activeTimer) {
      const newStats = { ...stats };
      if (activeTimer.type.includes('eye-rest')) {
        newStats.breaks = (newStats.breaks || 0) + 1;
      } else {
        newStats.focusTime = (newStats.focusTime || 0) + activeTimer.duration;
      }
      setStats(newStats);
      await saveData(tasks, newStats, dailyPriorities);
    }
    
    setActiveTimer(null);
    setTimerRemaining(0);
    setTimerRunning(false);
    setDeepWorkMode(false);
    setShowFloatingTimer(false);
  }, [activeTimer, stats, tasks, dailyPriorities, setActiveTimer, setTimerRemaining, setTimerRunning, setShowFloatingTimer]);

  // Callback quand le timer se termine (appelé par TimerManager)
  const handleTimerComplete = useCallback(async (timer) => {
    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Bifocus - Timer terminé !', {
        body: `${timer.type.replace(/-/g, ' ')} terminé`,
        icon: '/vite.svg',
        badge: '/vite.svg'
      });
    }

    const newStats = { ...stats };
    if (timer.type.includes('eye-rest')) {
      newStats.breaks = (newStats.breaks || 0) + 1;
    } else {
      newStats.focusTime = (newStats.focusTime || 0) + timer.duration;
    }
    setStats(newStats);
    await saveData(tasks, newStats, dailyPriorities);
    setDeepWorkMode(false);
  }, [stats, tasks, dailyPriorities]);

  // Task management
  const addTask = useCallback(async (task) => {
    const newTask = {
      id: Date.now(),
      ...task,
      status: 'todo',
      space: activeSpace,
      createdAt: new Date().toISOString(),
      actualTime: null
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    await saveData(newTasks, stats, dailyPriorities);
    setShowAddTask(false);
  }, [tasks, activeSpace, stats, dailyPriorities]);

  const updateTask = useCallback(async (id, updates) => {
    const newTasks = tasks.map(t => {
      if (t.id === id) {
        const updated = { ...t, ...updates };
        if (updates.status === 'done' && t.status !== 'done') {
          const newStats = { ...stats, tasksCompleted: (stats.tasksCompleted || 0) + 1 };
          setStats(newStats);
          saveData(tasks, newStats, dailyPriorities);
        }
        return updated;
      }
      return t;
    });
    setTasks(newTasks);
    await saveData(newTasks, stats, dailyPriorities);
  }, [tasks, stats, dailyPriorities]);

  const deleteTask = useCallback(async (id) => {
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    await saveData(newTasks, stats, dailyPriorities);
  }, [tasks, stats, dailyPriorities]);

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
  }, []);

  const handleShowAddTask = useCallback(() => {
    setShowAddTask(true);
  }, []);

  const TaskForm = ({ onSubmit, onCancel, initialData = null }) => {
    const [formData, setFormData] = useState(initialData || {
      title: '',
      description: '',
      context: 'work',
      startTime: '',
      endTime: '',
      estimatedMinutes: 30,
      priority: 'normal',
      energy: 'medium'
    });

    return (
      <div className="task-form">
        <input
          type="text"
          placeholder="Titre de la tâche"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="form-input"
          autoFocus
        />
        
        <textarea
          placeholder="Description (optionnel)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="form-textarea"
        />

        <div className="form-row">
          <select
            value={formData.context}
            onChange={(e) => setFormData({ ...formData, context: e.target.value })}
            className="form-select"
          >
            <option value="work">Travail</option>
            <option value="personal">Personnel</option>
          </select>

          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="form-select"
          >
            <option value="normal">Priorité normale</option>
            <option value="critical">Critique</option>
          </select>
        </div>

        <div className="form-row">
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            className="form-input"
            placeholder="Début"
          />
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            className="form-input"
            placeholder="Fin"
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Temps estimé (min)</label>
            <input
              type="number"
              value={formData.estimatedMinutes}
              onChange={(e) => setFormData({ ...formData, estimatedMinutes: parseInt(e.target.value) })}
              className="form-input"
              min="5"
              step="5"
            />
          </div>

          <div className="form-field">
            <label>Énergie requise</label>
            <select
              value={formData.energy}
              onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
              className="form-select"
            >
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
          <button 
            type="button"
            onClick={() => onSubmit(formData)}
            className="btn-primary"
            disabled={!formData.title}
          >
            {initialData ? 'Modifier' : 'Ajouter'}
          </button>
        </div>
      </div>
    );
  };

  const StatsView = () => {
    const todayTasks = tasks.filter(t => {
      const today = new Date().toDateString();
      return new Date(t.createdAt).toDateString() === today;
    });

    const completedToday = todayTasks.filter(t => t.status === 'done').length;
    const totalToday = todayTasks.length;

    return (
      <div className="stats-view">
        <h2>Performance & Statistiques</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Clock size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.focusTime || 0} min</div>
              <div className="stat-label">Temps de focus</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <CheckCircle2 size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.tasksCompleted || 0}</div>
              <div className="stat-label">Tâches terminées</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Eye size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.breaks || 0}</div>
              <div className="stat-label">Pauses prises</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Target size={32} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{completedToday}/{totalToday}</div>
              <div className="stat-label">Aujourd'hui</div>
            </div>
          </div>
        </div>

        {todayTasks.length > 0 && (
          <div className="today-summary">
            <h3>Résumé du jour</h3>
            <div className="completion-bar">
              <div 
                className="completion-fill"
                style={{ width: `${(completedToday / totalToday) * 100}%` }}
              />
            </div>
            <p>{Math.round((completedToday / totalToday) * 100)}% complété</p>
          </div>
        )}
      </div>
    );
  };

  const DashboardView = () => {
    const todayTasks = tasks
      .filter(t => {
        const today = new Date().toDateString();
        return new Date(t.createdAt).toDateString() === today;
      })
      .sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });

    const urgentTasks = tasks.filter(t => t.priority === 'critical' && t.status !== 'done');

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Bifocus</h1>
          <p className="dashboard-subtitle">Votre cockpit de productivité</p>
        </div>

        {urgentTasks.length > 0 && (
          <div className="priority-section">
            <h2><Target size={20} /> Tâches critiques</h2>
            <div className="tasks-list">
              {urgentTasks.slice(0, 3).map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                  onEdit={handleEditTask}
                />
              ))}
            </div>
          </div>
        )}

        <div className="today-section">
          <div className="section-header">
            <h2><Calendar size={20} /> Aujourd'hui</h2>
            <button type="button" onClick={handleShowAddTask} className="btn-primary">
              <Plus size={16} /> Nouvelle tâche
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="empty-state">
              <Target size={48} />
              <p>Aucune tâche pour aujourd'hui</p>
              <button type="button" onClick={handleShowAddTask} className="btn-primary">
                Créer votre première tâche
              </button>
            </div>
          ) : (
            <div className="tasks-list">
              {todayTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                  onEdit={handleEditTask}
                />
              ))}
            </div>
          )}
        </div>

        <TimerPanel 
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResumeTimer={resumeTimer}
          onStopTimer={() => stopTimer(false)}
        />
      </div>
    );
  };

  if (deepWorkMode && activeTimer) {
    const currentTask = tasks.find(t => t.status === 'in-progress');
    
    return (
      <div className="deep-work-mode">
        <div className="deep-work-content">
          <div className="deep-work-timer">
            {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}
          </div>
          
          {currentTask && (
            <div className="deep-work-task">
              <h1>{currentTask.title}</h1>
              {currentTask.description && <p>{currentTask.description}</p>}
            </div>
          )}

          <div className="deep-work-message">
            Focus absolu. Éliminez les distractions.
          </div>

          <button type="button" onClick={() => setDeepWorkMode(false)} className="btn-ghost">
            Quitter le mode Deep Work
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <nav className="sidebar">
        <div className="logo">
          <Zap size={28} />
          <span>bifocus</span>
        </div>

        <div className="space-switcher">
          <button 
            type="button"
            className={activeSpace === 'pro' ? 'active' : ''}
            onClick={() => setActiveSpace('pro')}
          >
            Sagemcom
          </button>
          <button 
            type="button"
            className={activeSpace === 'personal' ? 'active' : ''}
            onClick={() => setActiveSpace('personal')}
          >
            Personnel
          </button>
        </div>

        <div className="nav-links">
          <button 
            type="button"
            className={activeView === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveView('dashboard')}
          >
            <Target size={18} />
            Dashboard
          </button>
          <button 
            type="button"
            className={activeView === 'tasks' ? 'active' : ''}
            onClick={() => setActiveView('tasks')}
          >
            <CheckCircle2 size={18} />
            Tâches
          </button>
          <button 
            type="button"
            className={activeView === 'stats' ? 'active' : ''}
            onClick={() => setActiveView('stats')}
          >
            <BarChart3 size={18} />
            Stats
          </button>
        </div>

        <button 
          type="button"
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {darkMode ? 'Mode clair' : 'Mode sombre'}
        </button>
      </nav>

      <main className="main-content">
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'tasks' && (
          <div className="tasks-view">
            <div className="view-header">
              <h1>Toutes les tâches</h1>
              <button type="button" onClick={handleShowAddTask} className="btn-primary">
                <Plus size={16} /> Nouvelle tâche
              </button>
            </div>
            <div className="tasks-list">
              {tasks.filter(t => t.space === activeSpace).map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                  onEdit={handleEditTask}
                />
              ))}
            </div>
          </div>
        )}
        {activeView === 'stats' && <StatsView />}
      </main>

      {showAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nouvelle tâche</h2>
            <TaskForm 
              onSubmit={addTask}
              onCancel={() => setShowAddTask(false)}
            />
          </div>
        </div>
      )}

      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Modifier la tâche</h2>
            <TaskForm 
              initialData={editingTask}
              onSubmit={(data) => {
                updateTask(editingTask.id, data);
                setEditingTask(null);
              }}
              onCancel={() => setEditingTask(null)}
            />
          </div>
        </div>
      )}

      <TimerManager onTimerComplete={handleTimerComplete} />
      
      <FloatingTimer 
        onPause={pauseTimer}
        onResume={resumeTimer}
        onStop={() => stopTimer(false)}
      />

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          display: flex;
          font-family: 'Outfit', sans-serif;
          transition: all 0.3s ease;
        }

        .app.light {
          --bg-primary: #ffffff;
          --bg-secondary: #f8fafc;
          --bg-tertiary: #f1f5f9;
          --text-primary: #0f172a;
          --text-secondary: #475569;
          --text-tertiary: #94a3b8;
          --border-color: #e2e8f0;
          --accent-primary: #3b82f6;
          --accent-secondary: #06b6d4;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --shadow: rgba(0, 0, 0, 0.1);
          --glow: rgba(59, 130, 246, 0.3);
        }

        .app.dark {
          --bg-primary: #0a0a0a;
          --bg-secondary: #111111;
          --bg-tertiary: #1a1a1a;
          --text-primary: #f8fafc;
          --text-secondary: #cbd5e1;
          --text-tertiary: #64748b;
          --border-color: #1e293b;
          --accent-primary: #22d3ee;
          --accent-secondary: #10b981;
          --success: #22c55e;
          --warning: #fbbf24;
          --danger: #f87171;
          --shadow: rgba(0, 0, 0, 0.5);
          --glow: rgba(34, 211, 238, 0.4);
        }

        .app {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .sidebar {
          width: 280px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          position: sticky;
          top: 0;
          height: 100vh;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-primary);
          animation: fadeInDown 0.5s ease;
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .space-switcher {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-tertiary);
          padding: 0.25rem;
          border-radius: 12px;
          animation: fadeIn 0.5s ease 0.1s both;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .space-switcher button {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: 'Outfit', sans-serif;
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .space-switcher button.active {
          background: var(--accent-primary);
          color: white;
          box-shadow: 0 4px 12px var(--glow);
        }

        .nav-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          animation: fadeIn 0.5s ease 0.2s both;
        }

        .nav-links button {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .nav-links button:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .nav-links button.active {
          background: var(--bg-tertiary);
          color: var(--accent-primary);
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          color: var(--text-secondary);
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: auto;
        }

        .theme-toggle:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }

        .main-content {
          flex: 1;
          padding: 3rem;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          animation: fadeInUp 0.5s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dashboard-header {
          margin-bottom: 3rem;
        }

        .dashboard-header h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: slideIn 0.6s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .dashboard-subtitle {
          color: var(--text-secondary);
          font-size: 1.125rem;
        }

        .priority-section, .today-section {
          margin-bottom: 3rem;
          animation: fadeIn 0.5s ease;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .task-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.5rem;
          transition: all 0.3s ease;
          animation: scaleIn 0.3s ease;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .task-card:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 8px 24px var(--shadow);
          transform: translateY(-2px);
        }

        .task-card.critical {
          border-left: 4px solid var(--danger);
        }

        .task-card.done {
          opacity: 0.6;
        }

        .task-card.done h3 {
          text-decoration: line-through;
        }

        .task-header {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .task-status-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .task-status-btn:hover {
          color: var(--accent-primary);
          transform: scale(1.1);
        }

        .task-card.done .task-status-btn {
          color: var(--success);
        }

        .task-card.in-progress .task-status-btn {
          color: var(--warning);
        }

        .task-content {
          flex: 1;
        }

        .task-content h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }

        .task-description {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .task-meta {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-tertiary);
          font-size: 0.875rem;
          font-family: 'JetBrains Mono', monospace;
        }

        .task-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .icon-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .timer-panel {
          margin-top: 3rem;
          padding: 2rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          animation: fadeIn 0.5s ease 0.3s both;
        }

        .timer-panel h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
        }

        .timer-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .timer-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: 'Outfit', sans-serif;
        }

        .timer-btn:hover:not(:disabled) {
          border-color: var(--accent-primary);
          background: var(--bg-primary);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px var(--glow);
        }

        .timer-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .timer-btn.active {
          border-color: var(--accent-primary);
          background: var(--accent-primary);
          color: white;
        }

        .timer-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .timer-duration {
          font-size: 1.25rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .timer-subtitle {
          font-size: 0.875rem;
          color: var(--text-tertiary);
        }

        .active-timer {
          padding: 2rem;
          background: var(--bg-primary);
          border: 2px solid var(--accent-primary);
          border-radius: 20px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 20px var(--glow);
          }
          50% {
            box-shadow: 0 0 40px var(--glow);
          }
        }

        .timer-display {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .timer-time {
          font-size: 4rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-primary);
        }

        .timer-label-small {
          font-size: 1rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 0.5rem;
        }

        .timer-progress {
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 1.5rem;
        }

        .timer-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          transition: width 0.5s linear;
          border-radius: 999px;
        }

        .timer-controls {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn-primary, .btn-secondary, .btn-danger, .btn-ghost {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: var(--accent-primary);
          color: white;
        }

        .btn-primary:hover {
          background: var(--accent-secondary);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px var(--glow);
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
          background: var(--bg-secondary);
          border-color: var(--accent-primary);
        }

        .btn-danger {
          background: var(--danger);
          color: white;
        }

        .btn-danger:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-ghost:hover {
          color: var(--text-primary);
        }

        .stats-view {
          animation: fadeIn 0.5s ease;
        }

        .stats-view h2 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 2rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-card {
          display: flex;
          gap: 1.5rem;
          padding: 2rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          transition: all 0.3s ease;
          animation: scaleIn 0.3s ease;
        }

        .stat-card:hover {
          border-color: var(--accent-primary);
          box-shadow: 0 8px 24px var(--shadow);
          transform: translateY(-4px);
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: var(--bg-tertiary);
          border-radius: 16px;
          color: var(--accent-primary);
          flex-shrink: 0;
        }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-primary);
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .today-summary {
          padding: 2rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
        }

        .today-summary h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .completion-bar {
          height: 12px;
          background: var(--bg-tertiary);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .completion-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 999px;
          transition: width 0.5s ease;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
          backdrop-filter: blur(4px);
        }

        .modal {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }

        .task-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }

        .form-input:focus, .form-textarea:focus, .form-select:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--glow);
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-field label {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 4rem 2rem;
          text-align: center;
          color: var(--text-secondary);
        }

        .deep-work-mode {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.5s ease;
        }

        .deep-work-content {
          text-align: center;
          max-width: 800px;
          padding: 3rem;
        }

        .deep-work-timer {
          font-size: 8rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-primary);
          margin-bottom: 3rem;
          text-shadow: 0 0 60px var(--glow);
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% {
            text-shadow: 0 0 40px var(--glow);
          }
          50% {
            text-shadow: 0 0 80px var(--glow);
          }
        }

        .deep-work-task h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: white;
          margin-bottom: 1rem;
        }

        .deep-work-task p {
          font-size: 1.25rem;
          color: #94a3b8;
        }

        .deep-work-message {
          font-size: 1.125rem;
          color: #64748b;
          margin: 3rem 0;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.2em;
        }

        .tasks-view {
          animation: fadeIn 0.5s ease;
        }

        .view-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .view-header h1 {
          font-size: 2rem;
          font-weight: 700;
        }

        @media (max-width: 1024px) {
          .sidebar {
            width: 240px;
          }
          
          .main-content {
            padding: 2rem;
          }

          .timer-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .app {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: auto;
            position: relative;
          }

          .main-content {
            padding: 1.5rem;
          }

          .dashboard-header h1 {
            font-size: 2rem;
          }

          .timer-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .deep-work-timer {
            font-size: 4rem;
          }
        }

        /* Floating Timer Styles */
        .floating-timer {
          position: fixed;
          z-index: 9999;
          background: var(--bg-secondary);
          border: 2px solid var(--accent-primary);
          border-radius: 16px;
          padding: 1rem;
          box-shadow: 0 12px 40px var(--shadow), 0 0 30px var(--glow);
          cursor: move;
          user-select: none;
          min-width: 180px;
          backdrop-filter: blur(10px);
          animation: floatIn 0.3s ease;
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .floating-timer.dragging {
          cursor: grabbing;
          box-shadow: 0 16px 50px var(--shadow), 0 0 40px var(--glow);
        }

        .floating-timer.minimized {
          padding: 0.5rem;
          min-width: auto;
        }

        .floating-timer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          gap: 0.5rem;
        }

        .floating-timer.minimized .floating-timer-header {
          margin-bottom: 0;
        }

        .floating-timer-type {
          font-size: 1.5rem;
        }

        .floating-timer-minimize {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 0.25rem;
          font-size: 0.75rem;
          transition: all 0.2s ease;
        }

        .floating-timer-minimize:hover {
          color: var(--accent-primary);
          transform: scale(1.2);
        }

        .floating-timer .timer-time {
          font-size: 2rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-primary);
          text-align: center;
          margin-bottom: 0.75rem;
          text-shadow: 0 0 20px var(--glow);
        }

        .floating-timer-controls {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }

        .floating-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-primary);
        }

        .floating-btn:hover {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
          transform: scale(1.1);
        }

        .floating-btn.stop {
          background: var(--danger);
          border-color: var(--danger);
          color: white;
        }

        .floating-btn.stop:hover {
          background: #dc2626;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

// Wrapper principal avec TimerProvider
const App = () => {
  return (
    <TimerProvider>
      <BiFocus />
    </TimerProvider>
  );
};

export default App;