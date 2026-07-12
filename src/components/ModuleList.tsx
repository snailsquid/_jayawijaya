import { IoMdClose } from 'react-icons/io';
import type { Module, LiveCategory } from '../types/quiz';

interface ModuleRowProps {
  module: Module;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onDelete: () => void;
  isLive: boolean;
}

function ModuleRow({
  module,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onDelete,
  isLive,
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
        maxWidth: '100%'
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
        <span style={{ fontWeight: 600, display: 'block' }}>{module.title}</span>
        {module.description && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            style={{
              fontSize: '14px',
              color: '#666',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: isExpanded ? 'normal' : 'nowrap',
              wordBreak: 'break-word',
              maxHeight: isExpanded ? 'none' : '1.5em',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
              transition: 'text-decoration-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = '#666')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
          >
            {module.description}
          </span>
        )}
      </div>
      {!isLive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            width: '35px',
            height: '35px',
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #1a1a1a',
            background: '#ff6b9d',
            cursor: 'pointer',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <IoMdClose/>
        </button>
      )}
    </div>
  );
}

interface ModuleCategoryGroupProps {
  title: string;
  modules: Module[];
  selectedIds: string[];
  expandedModules: Set<string>;
  collapsedCategories: Set<string>;
  groupKey: string;
  onToggleModule: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDeleteModule: (id: string) => void;
  onToggleCollapse: (key: string) => void;
  onToggleSelectAll: (moduleIds: string[], select: boolean) => void;
  onDeleteCategory?: () => void;
  isLive?: boolean;
  liveInfo?: LiveCategory;
}

function CategoryDeleteButton({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #1a1a1a',
        background: color,
        cursor: 'pointer',
        fontWeight: 600,
        flexShrink: 0,
        padding: 0,
      }}
    >
      <IoMdClose />
    </button>
  );
}

function ModuleCategoryGroup({
  title,
  modules,
  selectedIds,
  expandedModules,
  collapsedCategories,
  groupKey,
  onToggleModule,
  onToggleExpand,
  onDeleteModule,
  onToggleCollapse,
  onToggleSelectAll,
  onDeleteCategory,
  isLive,
  liveInfo,
}: ModuleCategoryGroupProps) {
  const isCollapsed = collapsedCategories.has(groupKey);
  const moduleIds = modules.map(m => m.id);
  const allSelected = moduleIds.every(id => selectedIds.includes(id));

  const isSyncing = liveInfo?.isSyncing ?? false;
  const lastUpdated = liveInfo?.lastUpdated;

  return (
    <div
      className="neu-box"
      style={{
        width: '100%',
        overflow: 'hidden',
        padding: '12px',
        background: title === 'Uncategorized' ? '#fff' : '#f0f0f0',
        borderColor: isLive ? '#c084fc' : undefined,
        borderWidth: isLive ? '4px' : undefined,
      }}
    >
      <div
        onClick={() => onToggleCollapse(groupKey)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isCollapsed ? 0 : '12px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>{isCollapsed ? '▶' : '▼'} {title}</h3>
          {isLive && liveInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{
                background: '#c084fc',
                color: '#fff',
                padding: '2px 8px',
                fontWeight: 700,
              }}>
                LIVE
              </span>
              <span style={{ color: '#666' }}>v{liveInfo.version}</span>
              {isSyncing ? (
                <span style={{ color: '#c084fc', fontWeight: 700 }}>
                  Syncing...
                </span>
              ) : lastUpdated ? (
                <span style={{ color: '#888' }}>
                  {new Date(lastUpdated).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          )}
        </div>
        {!isCollapsed && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelectAll(moduleIds, !allSelected);
              }}
              className="neu-btn"
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            {onDeleteCategory && (
              <CategoryDeleteButton onClick={onDeleteCategory} color={isLive ? '#c084fc' : '#ff6b9d'} />
            )}
          </div>
        )}
      </div>
      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {modules.map(module => (
            <ModuleRow
              key={module.id}
              module={module}
              isSelected={selectedIds.includes(module.id)}
              isExpanded={expandedModules.has(module.id)}
              onToggleSelect={() => onToggleModule(module.id)}
              onToggleExpand={() => onToggleExpand(module.id)}
              onDelete={() => onDeleteModule(module.id)}
              isLive={isLive ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ModuleListProps {
  modules: Module[];
  selectedIds: string[];
  expandedModules: Set<string>;
  collapsedCategories: Set<string>;
  onToggleModule: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDeleteModule: (id: string) => void;
  onToggleCollapse: (key: string) => void;
  onToggleSelectAll: (moduleIds: string[], select: boolean) => void;
  liveCategories: LiveCategory[];
  onDeleteCategory: (categoryName: string) => void;
  onDeleteLiveCategory: (liveCategoryId: string) => void;
}

export function ModuleList({
  modules,
  selectedIds,
  expandedModules,
  collapsedCategories,
  onToggleModule,
  onToggleExpand,
  onDeleteModule,
  onToggleCollapse,
  onToggleSelectAll,
  liveCategories,
  onDeleteCategory,
  onDeleteLiveCategory,
}: ModuleListProps) {
  const liveCategoryNames = new Set(liveCategories.map(lc => lc.name));

  const regularCategories = Array.from(
    new Set(modules.map(m => m.categoryId).filter(Boolean))
  )
    .filter(name => !liveCategoryNames.has(name!))
    .sort();
  const uncategorized = modules.filter(m => !m.categoryId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {liveCategories.map(lc => {
        const catModules = modules.filter(m => m.liveCategoryId === lc.id);
        if (catModules.length === 0) return null;
        return (
          <ModuleCategoryGroup
            key={`live-${lc.id}`}
            title={lc.name}
            modules={catModules}
            selectedIds={selectedIds}
            expandedModules={expandedModules}
            collapsedCategories={collapsedCategories}
            groupKey={`live-${lc.id}`}
            onToggleModule={onToggleModule}
            onToggleExpand={onToggleExpand}
            onDeleteModule={onDeleteModule}
            onToggleCollapse={onToggleCollapse}
            onToggleSelectAll={onToggleSelectAll}
            onDeleteCategory={() => onDeleteLiveCategory(lc.id)}
            isLive
            liveInfo={lc}
          />
        );
      })}
      {regularCategories.map(category => (
        <ModuleCategoryGroup
          key={category}
          title={category!}
          modules={modules.filter(m => m.categoryId === category)}
          selectedIds={selectedIds}
          expandedModules={expandedModules}
          collapsedCategories={collapsedCategories}
          groupKey={category!}
          onToggleModule={onToggleModule}
          onToggleExpand={onToggleExpand}
          onDeleteModule={onDeleteModule}
          onToggleCollapse={onToggleCollapse}
          onToggleSelectAll={onToggleSelectAll}
          onDeleteCategory={() => onDeleteCategory(category!)}
        />
      ))}
      {uncategorized.length > 0 && (
        <ModuleCategoryGroup
          title="Uncategorized"
          modules={uncategorized}
          selectedIds={selectedIds}
          expandedModules={expandedModules}
          collapsedCategories={collapsedCategories}
          groupKey="__uncategorized__"
          onToggleModule={onToggleModule}
          onToggleExpand={onToggleExpand}
          onDeleteModule={onDeleteModule}
          onToggleCollapse={onToggleCollapse}
          onToggleSelectAll={onToggleSelectAll}
        />
      )}
    </div>
  );
}