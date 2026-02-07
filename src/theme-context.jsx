import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDay, setIsDay] = useState(true);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (!manualMode) {
      const checkTime = () => {
        const hour = new Date().getHours();
        setIsDay(hour >= 6 && hour < 18);
      };
      checkTime();
      const timer = setInterval(checkTime, 60000);
      return () => clearInterval(timer);
    }
  }, [manualMode]);

  const toggleMode = () => {
    setManualMode(true);
    setIsDay((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDay, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
