import { useState, useRef, useEffect } from 'react';
import { FiMaximize2, FiPackage } from 'react-icons/fi';

const MinimizedSyncModal = ({ syncRequest, onMaximize }) => {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem(`sync-modal-pos-${syncRequest._id}`);
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 220, y: 100 };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Boundary check
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 100;
        
        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));
        
        setPosition({ x: boundedX, y: boundedY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem(`sync-modal-pos-${syncRequest._id}`, JSON.stringify(position));
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, syncRequest._id]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return; // Don't drag when clicking buttons
    
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  if (!syncRequest) return null;

  const { order } = syncRequest;

  return (
    <div
      ref={modalRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white rounded-xl shadow-2xl p-4 w-56 border-2 border-white animate-bounce-gentle"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FiPackage className="text-xl" />
          <span className="font-bold text-sm">Sync Request</span>
        </div>
        <button
          onClick={onMaximize}
          className="no-drag p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          title="Expand"
        >
          <FiMaximize2 className="text-lg" />
        </button>
      </div>
      
      <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
        <p className="font-bold text-lg">{order.challanNumber}</p>
        <p className="text-xs text-white/80 mt-1">Click to expand</p>
      </div>
    </div>
  );
};

export default MinimizedSyncModal;
