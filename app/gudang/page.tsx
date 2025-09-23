'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GudangRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/gudang-final');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Gudang...</p>
      </div>
    </div>
  );
}