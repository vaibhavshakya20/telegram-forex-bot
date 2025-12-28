
import { useState, useEffect, useCallback } from 'react';
import { User, TradeResult, UserStatus, AppState } from './types';
import { ADMIN_ID } from './constants.tsx';

const STORAGE_KEY = 'tradeflow_state';

export const useBotStore = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      users: [],
      trades: [],
      adminId: ADMIN_ID
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const calculatePoints = (result: string): number => {
    if (result.toUpperCase() === 'SL') return -1;
    // Extract RR value from string like "1:2"
    const match = result.match(/1:(\d+)/);
    if (match) return parseInt(match[1], 10);
    return 0;
  };

  const startTrial = useCallback((userId: string, username: string) => {
    setState(prev => {
      if (prev.users.some(u => u.id === userId)) return prev;
      const newUser: User = {
        id: userId,
        username,
        joinTimestamp: Date.now(),
        tradesCount: 0,
        points: 0,
        status: UserStatus.ACTIVE,
        history: []
      };
      return { ...prev, users: [...prev.users, newUser] };
    });
  }, []);

  const addTradeResult = useCallback((tradeId: string, pair: string, result: string) => {
    const points = calculatePoints(result);
    const newTrade: TradeResult = {
      tradeId,
      pair,
      result,
      points,
      timestamp: Date.now()
    };

    setState(prev => {
      const updatedUsers = prev.users.map(user => {
        if (user.status === UserStatus.EXITED) return user;
        
        // Rules specify: trade added if active. 
        // Note: Logic says user sees trades where trade_timestamp >= user.join_timestamp
        // So we only update users whose join time is before this trade
        if (newTrade.timestamp >= user.joinTimestamp) {
          const newTradesCount = user.tradesCount + 1;
          const newPoints = user.points + points;
          const newStatus = (newTradesCount >= 10 && newPoints >= 10) ? UserStatus.EXITED : UserStatus.ACTIVE;
          
          return {
            ...user,
            tradesCount: newTradesCount,
            points: newPoints,
            status: newStatus,
            history: [...user.history, newTrade]
          };
        }
        return user;
      });

      return {
        ...prev,
        trades: [...prev.trades, newTrade],
        users: updatedUsers
      };
    });
  }, []);

  const editTradeResult = useCallback((tradeId: string, newResult: string) => {
    const newPointsValue = calculatePoints(newResult);

    setState(prev => {
      return {
        ...prev,
        trades: prev.trades.map(t => t.tradeId === tradeId ? { ...t, result: newResult, points: newPointsValue } : t),
        users: prev.users.map(user => {
          // If user already exited, do not reactivate
          const tradeToEdit = user.history.find(h => h.tradeId === tradeId);
          if (!tradeToEdit) return user;

          const oldPoints = tradeToEdit.points;
          const pointDiff = newPointsValue - oldPoints;
          const updatedPoints = user.points + pointDiff;

          // Re-calculate status (though rule says don't reactivate if already exited)
          let finalStatus = user.status;
          // If they are active and now meet exit criteria, exit them
          if (user.status === UserStatus.ACTIVE && user.tradesCount >= 10 && updatedPoints >= 10) {
            finalStatus = UserStatus.EXITED;
          }

          return {
            ...user,
            points: updatedPoints,
            status: finalStatus,
            history: user.history.map(h => h.tradeId === tradeId ? { ...h, result: newResult, points: newPointsValue } : h)
          };
        })
      };
    });
  }, []);

  const deleteTradeResult = useCallback((tradeId: string) => {
    setState(prev => {
      return {
        ...prev,
        trades: prev.trades.filter(t => t.tradeId !== tradeId),
        users: prev.users.map(user => {
          const tradeToDelete = user.history.find(h => h.tradeId === tradeId);
          if (!tradeToDelete || user.status === UserStatus.EXITED) return user;

          return {
            ...user,
            tradesCount: user.tradesCount - 1,
            points: user.points - tradeToDelete.points,
            history: user.history.filter(h => h.tradeId !== tradeId)
          };
        })
      };
    });
  }, []);

  const resetAll = useCallback(() => {
    const confirmed = window.confirm("Are you sure you want to wipe all data? This cannot be undone.");
    if (confirmed) {
      setState({
        users: [],
        trades: [],
        adminId: ADMIN_ID
      });
    }
  }, []);

  return {
    state,
    startTrial,
    addTradeResult,
    editTradeResult,
    deleteTradeResult,
    resetAll
  };
};
