'use client';

import { useEffect, useRef } from 'react';
import { Trash2, Ban, BellOff, Pin } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onMute: () => void;
  onPin: () => void;
  isPinned?: boolean;
}

export default function ContextMenu({
  x,
  y,
  onClose,
  onDelete,
  onBlock,
  onMute,
  onPin,
  isPinned = false,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: Pin,
      label: isPinned ? 'Unpin chat' : 'Pin chat',
      onClick: onPin,
      className: 'text-gray-700 hover:bg-gray-100',
    },
    {
      icon: BellOff,
      label: 'Mute',
      onClick: onMute,
      className: 'text-gray-700 hover:bg-gray-100',
    },
    {
      icon: Ban,
      label: 'Block',
      onClick: onBlock,
      className: 'text-gray-700 hover:bg-gray-100',
    },
    {
      icon: Trash2,
      label: 'Delete chat',
      onClick: onDelete,
      className: 'text-red-600 hover:bg-red-50',
      divider: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px] z-50"
      style={{ top: y, left: x }}
    >
      {menuItems.map((item, index) => (
        <div key={index}>
          {item.divider && <div className="border-t border-gray-200 my-2" />}
          <button
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${item.className}`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
