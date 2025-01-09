"use client"

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '../components/ui/use-toast';

interface ProjectContextType {
  projectDetails: string;
  setProjectDetails: (details: string) => void;
  refreshProjectDetails: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'projectDetails';

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectDetails, setProjectDetailsState] = useState('');
  const { toast } = useToast();

  // Load from localStorage on mount
  useEffect(() => {
    const savedDetails = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedDetails) {
      setProjectDetailsState(savedDetails);
    }
  }, []);

  const setProjectDetails = async (details: string) => {
    try {
      // Save to API
      const response = await fetch('/api/project-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details })
      });

      if (!response.ok) {
        throw new Error('Failed to save project details');
      }

      // If API save successful, update state and localStorage
      setProjectDetailsState(details);
      localStorage.setItem(LOCAL_STORAGE_KEY, details);
    } catch (error) {
      console.error('Error saving project details:', error);
      // If API fails, still update localStorage as backup
      setProjectDetailsState(details);
      localStorage.setItem(LOCAL_STORAGE_KEY, details);
      toast({
        title: "Warning",
        description: "Project details saved locally only. Some features may be limited.",
        variant: "destructive",
      });
    }
  };

  const refreshProjectDetails = async () => {
    try {
      const response = await fetch('/api/project-details');
      if (!response.ok) {
        throw new Error('Failed to fetch project details');
      }
      const data = await response.json();
      const details = data.details || '';
      
      // Update both state and localStorage
      setProjectDetailsState(details);
      localStorage.setItem(LOCAL_STORAGE_KEY, details);
    } catch (error) {
      console.error('Error fetching project details:', error);
      // If API fails, try to load from localStorage
      const savedDetails = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDetails) {
        setProjectDetailsState(savedDetails);
      }
      toast({
        title: "Warning",
        description: "Using locally saved project details. Some features may be limited.",
        variant: "destructive",
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    refreshProjectDetails();
  }, []);

  return (
    <ProjectContext.Provider value={{ projectDetails, setProjectDetails, refreshProjectDetails }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
