"use client"

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '../components/ui/use-toast';

interface ProjectContextType {
  projectDetails: string;
  setProjectDetails: (details: string) => void;
  refreshProjectDetails: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectDetails, setProjectDetails] = useState('');
  const { toast } = useToast();

  const refreshProjectDetails = async () => {
    try {
      const response = await fetch('/api/project-details');
      if (!response.ok) {
        throw new Error('Failed to fetch project details');
      }
      const data = await response.json();
      setProjectDetails(data.details || '');
    } catch (error) {
      console.error('Error fetching project details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch project details",
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
