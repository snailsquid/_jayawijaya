import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Module, QuizMode } from '../types/quiz';
import { ModeSelector } from '../components/ModeSelector';
import { ModuleUploader } from '../components/ModuleUploader';

interface QuizConfig {
  selectedModuleIds: string[];
  mode: QuizMode;
  randomize: boolean;
}

interface ModuleRowProps {
  module: Module;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
}

function ModuleRow({
  module,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onDelete,
}: ModuleRowProps) {
  return (
    <div
      onClick={onToggleSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        border: '2px solid #1a1a1a',
        background: isSelected ? '#00d4ff' : 'white',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '20px', height: '20px', marginTop: '4px', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontWeight: 600, display: 'block' }}>{module.title}</span>
          {module.description && (
            <span
              style={{
                fontSize: '14px',
                color: '#666',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: isExpanded ? 'normal' : 'nowrap',
                maxHeight: isExpanded ? 'none' : '1.5em',
              }}
            >
              {module.description}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          padding: '8px 12px',
          border: '2px solid #1a1a1a',
          background: '#ff6b9d',
          cursor: 'pointer',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        X
      </button>
    </div>
  );
}

export function Start() {
  const navigate = useNavigate();
  const [modules, setModules] = useLocalStorage<Module[]>('jayawijaya-modules', []);
  const [config, setConfig] = useLocalStorage<QuizConfig>('jayawijaya-config', {
    selectedModuleIds: [],
    mode: 'practice',
    randomize: false,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [assignCategory, setAssignCategory] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    modules.forEach(m => {
      if (m.categoryId) cats.add(m.categoryId);
    });
    return Array.from(cats).sort();
  }, [modules]);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return modules;
    const query = searchQuery.toLowerCase();
    return modules.filter(m => 
      m.title.toLowerCase().includes(query) ||
      m.categoryId?.toLowerCase().includes(query)
    );
  }, [modules, searchQuery]);

  const groupedModules = useMemo(() => {
    const groups: Record<string, Module[]> = {};
    const uncategorized: Module[] = [];
    
    for (const mod of filteredModules) {
      if (mod.categoryId) {
        if (!groups[mod.categoryId]) {
          groups[mod.categoryId] = [];
        }
        groups[mod.categoryId].push(mod);
      } else {
        uncategorized.push(mod);
      }
    }
    
    return { groups, uncategorized };
  }, [filteredModules]);

  const sortedCategories = Object.keys(groupedModules.groups).sort();

  const handleUpload = useCallback((newModules: Module[]) => {
    setModules(prev => [...prev, ...newModules]);
  }, [setModules]);

  const handleToggleModule = useCallback((moduleId: string) => {
    setConfig(prev => ({
      ...prev,
      selectedModuleIds: prev.selectedModuleIds.includes(moduleId)
        ? prev.selectedModuleIds.filter(id => id !== moduleId)
        : [...prev.selectedModuleIds, moduleId]
    }));
  }, [setConfig]);

  const handleToggleExpand = useCallback((moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  const handleDeleteModule = useCallback((moduleId: string) => {
    setModules(prev => prev.filter(m => m.id !== moduleId));
    setConfig(prev => ({
      ...prev,
      selectedModuleIds: prev.selectedModuleIds.filter(id => id !== moduleId)
    }));
  }, [setModules, setConfig]);

  const handleMassAssign = useCallback(() => {
    if (!assignCategory) return;
    const finalCategory = assignCategory.startsWith('__new__:')
      ? assignCategory.slice(7)
      : assignCategory;
    setConfig(prev => {
      const newModules = modules.map(m => {
        if (prev.selectedModuleIds.includes(m.id)) {
          return { ...m, categoryId: finalCategory };
        }
        return m;
      });
      setModules(newModules);
      return { ...prev, selectedModuleIds: [] };
    });
    setAssignCategory('');
  }, [assignCategory, setConfig, modules, setModules]);

  const handleMassDelete = useCallback(() => {
    setModules(prev => prev.filter(m => !config.selectedModuleIds.includes(m.id)));
    setConfig(prev => ({ ...prev, selectedModuleIds: [] }));
  }, [config.selectedModuleIds, setModules, setConfig]);

  const handleStart = () => {
    if (config.selectedModuleIds.length === 0) return;
    
    const selectedModules = modules.filter(m => config.selectedModuleIds.includes(m.id));
    navigate('/running', {
      state: {
        modules: selectedModules,
        mode: config.mode,
        randomize: config.randomize,
      },
    });
  };

  const totalQuestions = modules
    .filter(m => config.selectedModuleIds.includes(m.id))
    .reduce((sum, m) => sum + m.questions.length, 0);

  const hasSelection = config.selectedModuleIds.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>START</h1>
        <button onClick={() => navigate('/')} className="neu-btn">
          ← Back
        </button>
      </div>

      <div className="neu-box" style={{ padding: '24px' }}>
        <h2 style={{ marginBottom: '16px', fontWeight: 700 }}>Mode</h2>
        <ModeSelector mode={config.mode} onChange={mode => setConfig(prev => ({ ...prev, mode }))} />
        <p style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
          {config.mode === 'practice'
            ? 'Reveals answer on each submission'
            : 'Reveals answers after all submissions'}
        </p>
      </div>

      {hasSelection && (
        <div className="neu-box" style={{ padding: '16px', background: '#ffd93d' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>
              {config.selectedModuleIds.length} selected:
            </span>
            <div style={{ display: 'flex', gap: '8px', flex: '1 1 200px', minWidth: '150px' }}>
              <input
                type="text"
                list="category-options"
                value={assignCategory}
                onChange={e => setAssignCategory(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleMassAssign();
                }}
                placeholder="Type to search or create..."
                className="neu-input"
                style={{ flex: '1' }}
              />
              <datalist id="category-options">
                {categories
                  .filter(cat => !assignCategory || cat.toLowerCase().includes(assignCategory.toLowerCase()))
                  .map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))
                }
              </datalist>
            </div>
            <button
              onClick={handleMassAssign}
              disabled={!assignCategory}
              className="neu-btn"
            >
              {assignCategory && !categories.includes(assignCategory) ? 'Create & Assign' : 'Assign'}
            </button>
            <button
              onClick={handleMassDelete}
              className="neu-btn"
              style={{ background: '#ff6b9d' }}
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="neu-box" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontWeight: 700 }}>Modules</h2>
          <ModuleUploader onUpload={handleUpload} existingModules={modules} />
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search categories or module names..."
          className="neu-input"
          style={{ width: '100%', marginBottom: '16px' }}
        />
        
        {modules.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#666' }}>No modules uploaded yet.</p>
            <p style={{ color: '#666', fontSize: '14px' }}>
              See <code style={{ background: '#eee', padding: '2px 6px' }}>example_module.yaml</code> for format reference
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedCategories.map(category => {
              const moduleIds = groupedModules.groups[category].map(m => m.id);
              const allSelected = moduleIds.every(id => config.selectedModuleIds.includes(id));
              return (
                <div key={category} className="neu-box" style={{ padding: '12px', background: '#f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>{category}</h3>
                    <button
                      onClick={() => {
                        if (allSelected) {
                          setConfig(prev => ({ ...prev, selectedModuleIds: prev.selectedModuleIds.filter(id => !moduleIds.includes(id)) }));
                        } else {
                          setConfig(prev => ({ ...prev, selectedModuleIds: [...new Set([...prev.selectedModuleIds, ...moduleIds])] }));
                        }
                      }}
                      className="neu-btn"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {groupedModules.groups[category].map(module => (
                      <ModuleRow
                        key={module.id}
                        module={module}
                        isSelected={config.selectedModuleIds.includes(module.id)}
                        isExpanded={expandedModules.has(module.id)}
                        onToggleSelect={() => handleToggleModule(module.id)}
                        onToggleExpand={() => handleToggleExpand(module.id)}
                        onDelete={() => handleDeleteModule(module.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            
            {groupedModules.uncategorized.length > 0 && (() => {
              const moduleIds = groupedModules.uncategorized.map(m => m.id);
              const allSelected = moduleIds.every(id => config.selectedModuleIds.includes(id));
              return (
                <div className="neu-box" style={{ padding: '12px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Uncategorized</h3>
                    <button
                      onClick={() => {
                        if (allSelected) {
                          setConfig(prev => ({ ...prev, selectedModuleIds: prev.selectedModuleIds.filter(id => !moduleIds.includes(id)) }));
                        } else {
                          setConfig(prev => ({ ...prev, selectedModuleIds: [...new Set([...prev.selectedModuleIds, ...moduleIds])] }));
                        }
                      }}
                      className="neu-btn"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {groupedModules.uncategorized.map(module => (
                      <ModuleRow
                        key={module.id}
                        module={module}
                        isSelected={config.selectedModuleIds.includes(module.id)}
                        isExpanded={expandedModules.has(module.id)}
                        onToggleSelect={() => handleToggleModule(module.id)}
                        onToggleExpand={() => handleToggleExpand(module.id)}
                        onDelete={() => handleDeleteModule(module.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="neu-box" style={{ padding: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={config.randomize}
            onChange={e => setConfig(prev => ({ ...prev, randomize: e.target.checked }))}
            style={{ width: '24px', height: '24px' }}
          />
          <span style={{ fontWeight: 700, fontSize: '18px' }}>Randomize Questions</span>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>
          Selected: {config.selectedModuleIds.length} modules, {totalQuestions} questions
        </div>
        <button
          onClick={handleStart}
          disabled={config.selectedModuleIds.length === 0}
          className="neu-btn neu-btn-primary"
          style={{
            fontSize: '20px',
            padding: '16px 32px',
            opacity: config.selectedModuleIds.length === 0 ? 0.5 : 1,
          }}
        >
          START QUIZ
        </button>
      </div>
    </div>
  );
}