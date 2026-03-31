'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { Button } from './Button';

const sizeClasses = {
  sm: 'ui-modal-sm',
  md: 'ui-modal-md',
  lg: 'ui-modal-lg',
  xl: 'ui-modal-xl'
};

export function Modal({
  open,
  onClose,
  children,
  className = '',
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true
}) {
  useEffect(() => {
    if (!open || !closeOnEscape) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open || typeof window === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="ui-modal-overlay">
      <div
        className="ui-modal-backdrop"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div role="dialog" aria-modal="true" className={cn('ui-modal', sizeClasses[size] || sizeClasses.md, className)}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ className = '', children, onClose, ...props }) {
  return (
    <div className={cn('ui-modal-header', className)} {...props}>
      <div className="ui-modal-header-copy">{children}</div>
      {onClose ? (
        <Button variant="icon" size="icon" onClick={onClose} aria-label="Close modal">
          X
        </Button>
      ) : null}
    </div>
  );
}

export function ModalTitle({ className = '', children, ...props }) {
  return (
    <h2 className={cn('ui-modal-title', className)} {...props}>
      {children}
    </h2>
  );
}

export function ModalDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('ui-modal-description', className)} {...props}>
      {children}
    </p>
  );
}

export function ModalBody({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-modal-body', className)} {...props}>
      {children}
    </div>
  );
}

export function ModalFooter({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-modal-footer', className)} {...props}>
      {children}
    </div>
  );
}
