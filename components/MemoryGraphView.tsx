import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { RagMemory, RagMemoryTag } from '../types';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const X_SPACING = 80;
const Y_SPACING = 60;
const NODES_PER_ROW = 3;

const TagPill: React.FC<{ tag: RagMemoryTag }> = ({ tag }) => {
  const colors: Record<string, string> = {
    character: 'bg-blue-900/50 text-blue-300',
    location: 'bg-green-900/50 text-green-300',
    event: 'bg-purple-900/50 text-purple-300',
    theme: 'bg-yellow-900/50 text-yellow-300',
  };
  return (
    <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${colors[tag.type]}`}>
      {tag.value}
    </span>
  );
};

const MemoryNode: React.FC<{ memory: RagMemory; pos: { x: number; y: number } }> = ({ memory, pos }) => (
  <div
    className="absolute p-3 rounded-xl shadow-lg transition-all duration-300 text-left text-sm"
    style={{
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      width: `${NODE_WIDTH}px`,
      height: `${NODE_HEIGHT}px`,
      backgroundColor: 'var(--tertiary-bg)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      // FIX: The original box-shadow used an undefined CSS variable (--accent-primary-rgb).
      // This is replaced with a modern color-mix function to create a proper glow effect
      // that works with the existing theme variables.
      boxShadow: '0 0 20px 5px color-mix(in srgb, var(--accent-primary) 20%, transparent)',
    }}
  >
    <p className="flex-1 text-xs overflow-y-auto hide-scrollbar leading-relaxed">
      {memory.summary || memory.fullText}
    </p>
    {(memory.tags || memory.mood) && (
      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-dashed border-color">
          {memory.mood && <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-slate-700 text-slate-200">{memory.mood}</span>}
          {(memory.tags || []).map(tag => <TagPill key={`${tag.type}:${tag.value}`} tag={tag} />)}
      </div>
    )}
  </div>
);

const MemoryGraphView: React.FC<{ memories: RagMemory[] }> = ({ memories }) => {
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 0.8 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedMemories = useMemo(() => memories, [memories]);

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number, y: number }>();
    sortedMemories.forEach((mem, i) => {
      const row = Math.floor(i / NODES_PER_ROW);
      const colInRow = i % NODES_PER_ROW;
      
      const isReversed = row % 2 !== 0;
      const x = isReversed 
        ? (NODES_PER_ROW - 1 - colInRow) * (NODE_WIDTH + X_SPACING)
        : colInRow * (NODE_WIDTH + X_SPACING);
      
      const y = row * (NODE_HEIGHT + Y_SPACING);
      positions.set(mem.id, { x, y });
    });
    return positions;
  }, [sortedMemories]);

  const edges = useMemo(() => {
    return sortedMemories
      .map((mem, i) => {
        if (i === 0) return null;
        const prevMem = sortedMemories[i - 1];
        const p1 = nodePositions.get(prevMem.id);
        const p2 = nodePositions.get(mem.id);
        if (!p1 || !p2) return null;
        
        const row1 = Math.floor((i - 1) / NODES_PER_ROW);
        const row2 = Math.floor(i / NODES_PER_ROW);

        let d = `M ${p1.x + NODE_WIDTH / 2} ${p1.y + NODE_HEIGHT / 2} `;
        if (row1 === row2) {
             d += `L ${p2.x + NODE_WIDTH / 2} ${p2.y + NODE_HEIGHT / 2}`;
        } else {
            // Snake-like vertical connection
            d += `C ${p1.x + NODE_WIDTH / 2} ${p1.y + NODE_HEIGHT / 2 + Y_SPACING / 2}, ` +
                 `${p2.x + NODE_WIDTH / 2} ${p2.y + NODE_HEIGHT / 2 - Y_SPACING / 2}, ` +
                 `${p2.x + NODE_WIDTH / 2} ${p2.y + NODE_HEIGHT / 2}`;
        }
        return { id: `${prevMem.id}-${mem.id}`, d };
      })
      .filter((e): e is { id: string, d: string } => !!e);
  }, [sortedMemories, nodePositions]);
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.max(0.1, Math.min(2, viewState.scale + scaleAmount));
    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewState(prev => ({
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale)
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
    if(containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setViewState(prev => ({ ...prev, x: e.clientX - startPan.x, y: e.clientY - startPan.y }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if(containerRef.current) containerRef.current.style.cursor = 'grab';
  };

  const centerView = useCallback(() => {
    if (!containerRef.current || nodePositions.size === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    setViewState(prev => ({
        ...prev,
        x: rect.width / 2 - (NODE_WIDTH / 2),
        y: rect.height / 2 - (NODE_HEIGHT / 2),
    }));
  }, [nodePositions.size]);

  useEffect(() => {
    centerView();
  }, [centerView]);
  
  // NEW: Handle the empty state gracefully to avoid a blank screen.
  if (sortedMemories.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-center bg-primary-bg">
        <h3 className="text-xl font-semibold text-text-primary">No Memories to Display</h3>
        <p className="mt-2 text-text-secondary">
          This graph will populate with "neural cells" representing conversation memories
          as you chat with the RAG (Retrieval-Augmented Generation) feature enabled in settings.
        </p>
        <p className="mt-1 text-xs text-text-secondary/70">
          Settings &gt; RAG &gt; Enable RAG
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-primary-bg cursor-grab"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="transition-transform duration-100 ease-out"
        style={{
          transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          className="absolute top-0 left-0"
          style={{
            width: `${(NODE_WIDTH + X_SPACING) * NODES_PER_ROW}px`,
            height: `${(NODE_HEIGHT + Y_SPACING) * Math.ceil(sortedMemories.length / NODES_PER_ROW)}px`,
            pointerEvents: 'none',
          }}
        >
          <defs>
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: 'var(--accent-primary)', stopOpacity: 0.1 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--accent-primary)', stopOpacity: 1 }} />
              </linearGradient>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)" />
              </marker>
          </defs>
          <g>
            {edges.map(edge => (
              <path
                key={edge.id}
                d={edge.d}
                stroke="url(#edgeGradient)"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrow)"
              />
            ))}
          </g>
        </svg>

        {sortedMemories.map(mem => {
          const pos = nodePositions.get(mem.id);
          return pos ? <MemoryNode key={mem.id} memory={mem} pos={pos} /> : null;
        })}
      </div>
      <button onClick={centerView} className="absolute bottom-4 right-4 px-3 py-1.5 text-xs font-semibold rounded-lg btn-secondary shadow-lg">Center View</button>
    </div>
  );
};

export default MemoryGraphView;