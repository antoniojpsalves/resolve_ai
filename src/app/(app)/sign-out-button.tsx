'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { Button } from '@/components/ui/button';

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void signOut({ callbackUrl: '/login' });
      }}
    >
      <LogOut aria-hidden />
      Sair
    </Button>
  );
}
