import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmButtonText?: string;
  confirmButtonVariant?: 'primary' | 'secondary' | 'danger';
  confirmationKeyword?: string; // e.g., "DELETE"
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message,
    confirmButtonText = 'Xác nhận',
    confirmButtonVariant = 'danger',
    confirmationKeyword,
}) => {
  const [inputText, setInputText] = useState('');
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(!!confirmationKeyword);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setInputText('');
      setIsConfirmDisabled(!!confirmationKeyword);
    }
  }, [isOpen, confirmationKeyword]);
  
  const handleConfirm = () => {
    if (isConfirmDisabled) return;
    onConfirm();
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (confirmationKeyword) {
        setIsConfirmDisabled(e.target.value !== confirmationKeyword);
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-gray-700 dark:text-gray-300">
        {message}
      </div>

      {confirmationKeyword && (
        <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Để xác nhận, vui lòng nhập "<strong>{confirmationKeyword}</strong>" vào ô bên dưới.
            </label>
            <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                className="form-input mt-1"
                autoFocus
            />
        </div>
      )}

      <div className="flex justify-end space-x-4 mt-6 pt-4 border-t dark:border-gray-700">
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
        <Button variant={confirmButtonVariant} onClick={handleConfirm} disabled={isConfirmDisabled}>
          {confirmButtonText}
        </Button>
      </div>
    </Modal>
  );
};