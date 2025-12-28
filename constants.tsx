
import React from 'react';
import { Shield, User, BarChart3, MessageSquare, Terminal, Settings } from 'lucide-react';

export const ADMIN_ID = "ADMIN_12345";

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={20} /> },
  { id: 'admin', label: 'Admin Terminal', icon: <Terminal size={20} /> },
  { id: 'users', label: 'User Directory', icon: <User size={20} /> },
  { id: 'simulator', label: 'Bot Simulator', icon: <MessageSquare size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

export const DISCLAIMER = "This system shares trade outcomes for learning and tracking only. No prices or trade advice are provided.";
