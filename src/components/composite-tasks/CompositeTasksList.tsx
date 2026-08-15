import React from 'react';
import { CompositeTasksListEnhanced } from './CompositeTasksListEnhanced';

interface CompositeTasksListProps {
  customerId?: string;
}

export const CompositeTasksList: React.FC<CompositeTasksListProps> = ({ customerId }) => {
  return <CompositeTasksListEnhanced customerId={customerId} />;
};
