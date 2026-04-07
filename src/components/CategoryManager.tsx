import { useState } from 'react';
import type { Module, Category } from '../types/quiz';

interface CategoryManagerProps {
  modules: Module[];
  categories: Category[];
  selectedModuleIds: string[];
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
  onToggleModule: (moduleId: string) => void;
  onToggleAllInCategory: (categoryId: string) => void;
  onToggleCategoryExpand: (categoryId: string) => void;
  onDeleteModule: (moduleId: string) => void;
}

export function CategoryManager({
  modules,
  categories,
  selectedModuleIds,
  onAddCategory,
  onDeleteCategory,
  onToggleModule,
  onToggleAllInCategory,
  onToggleCategoryExpand,
  onDeleteModule,
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('');

  const uncategorizedModules = modules.filter(
    (m) => !m.categoryId && !categories.some((c) => c.moduleIds.includes(m.id))
  );

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name..."
          className="neu-input"
          style={{ flex: 1 }}
        />
        <button onClick={handleAddCategory} className="neu-btn neu-btn-secondary">
          Add
        </button>
      </div>

      {categories.map((category) => {
        const categoryModules = modules.filter((m) => m.categoryId === category.id);
        const allSelected = categoryModules.every((m) =>
          selectedModuleIds.includes(m.id)
        );

        return (
          <div key={category.id} className="neu-box" style={{ padding: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <button
                onClick={() => onToggleCategoryExpand(category.id)}
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {category.isExpanded ? '▼' : '▶'} {category.name}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onToggleAllInCategory(category.id)}
                  className="neu-btn"
                  style={{ fontSize: '12px', padding: '8px 12px' }}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={() => onDeleteCategory(category.id)}
                  className="neu-btn"
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    background: '#ff6b9d',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {category.isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categoryModules.map((module) => (
                  <div
                    key={module.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      border: '2px solid #1a1a1a',
                      background: selectedModuleIds.includes(module.id)
                        ? '#00d4ff'
                        : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModuleIds.includes(module.id)}
                      onChange={() => onToggleModule(module.id)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <span style={{ flex: 1, fontWeight: 600 }}>
                      {module.title}
                    </span>
                    <button
                      onClick={() => onDeleteModule(module.id)}
                      style={{
                        padding: '4px 8px',
                        border: '2px solid #1a1a1a',
                        background: '#ff6b9d',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="neu-box" style={{ padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: 700 }}>Uncategorized</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {uncategorizedModules.map((module) => (
            <div
              key={module.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                border: '2px solid #1a1a1a',
                background: selectedModuleIds.includes(module.id)
                  ? '#00d4ff'
                  : 'white',
              }}
            >
              <input
                type="checkbox"
                checked={selectedModuleIds.includes(module.id)}
                onChange={() => onToggleModule(module.id)}
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ flex: 1, fontWeight: 600 }}>{module.title}</span>
              <button
                onClick={() => onDeleteModule(module.id)}
                style={{
                  padding: '4px 8px',
                  border: '2px solid #1a1a1a',
                  background: '#ff6b9d',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                X
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}