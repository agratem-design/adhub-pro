import { useState } from 'react';
import { isContractExpired as isContractExpiredUtil } from '@/utils/contractUtils';

export const useBillboardActions = () => {
  // Check if contract is expired
  const isContractExpired = (endDate: string | null | undefined): boolean => {
    return isContractExpiredUtil(endDate ?? null);
  };

  // Check if billboard has active contract
  const hasActiveContract = (billboard: any): boolean => {
    const contractNumber = billboard?.Contract_Number || billboard?.contractNumber;
    const endDate = billboard?.Rent_End_Date || billboard?.rent_end_date;
    
    if (!contractNumber) return false;
    
    return !isContractExpired(endDate);
  };

  // Upload image to folder
  const uploadImageToFolder = async (file: File, fileName: string): Promise<boolean> => {
    try {
      // This is a placeholder for actual image upload logic
      // In a real implementation, you would upload to your storage service
      console.log(`Uploading image: ${fileName}`);
      return true;
    } catch (error) {
      console.error('Error uploading image:', error);
      return false;
    }
  };

  // Add municipality if new
  const addMunicipalityIfNew = async (
    name: string, 
    municipalities: any[], 
    setMunicipalities: any, 
    setDbMunicipalities: any
  ): Promise<void> => {
    const exists = municipalities.some(m => m.name === name);
    if (!exists) {
      // Add to local state
      const newMunicipality = { id: Date.now(), name };
      setMunicipalities([...municipalities, newMunicipality]);
      setDbMunicipalities((prev: string[]) => [...prev, name]);
    }
  };

  // Add size if new
  const addSizeIfNew = async (
    sizeName: string, 
    level: string, 
    sizes: any[], 
    setSizes: any, 
    setDbSizes: any
  ): Promise<void> => {
    const exists = sizes.some(s => s.name === sizeName);
    if (!exists) {
      const newSize = { id: Date.now(), name: sizeName, level };
      setSizes([...sizes, newSize]);
      setDbSizes((prev: string[]) => [...prev, sizeName]);
    }
  };

  // Add level if new
  const addLevelIfNew = async (
    level: string, 
    levels: string[], 
    setLevels: any
  ): Promise<void> => {
    const exists = levels.includes(level);
    if (!exists) {
      setLevels([...levels, level]);
    }
  };

  // Add billboard type if new
  const addBillboardTypeIfNew = async (
    typeName: string, 
    billboardTypes: string[], 
    setBillboardTypes: any
  ): Promise<void> => {
    const exists = billboardTypes.includes(typeName);
    if (!exists) {
      setBillboardTypes([...billboardTypes, typeName]);
    }
  };

  return {
    isContractExpired,
    hasActiveContract,
    uploadImageToFolder,
    addMunicipalityIfNew,
    addSizeIfNew,
    addLevelIfNew,
    addBillboardTypeIfNew
  };
};