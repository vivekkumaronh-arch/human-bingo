import React from 'react';
import { Database } from 'lucide-react';

export const SupabaseSetupNotice: React.FC = () => {
  return (
    <div className="min-h-dvh w-full bg-[#F5F7FA] text-[#142B49] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-[#DCE3EC] p-6 sm:p-8 shadow-[0_12px_34px_rgba(20,43,73,0.08)]">
        <div className="w-11 h-11 rounded-2xl bg-[#FBF6EE] border border-[#EAE0CF] text-[#258A83] flex items-center justify-center mb-4">
          <Database className="w-5 h-5" aria-hidden="true" />
        </div>

        <p className="text-[11px] font-bold tracking-[0.18em] text-[#258A83]">
          MULTIPLAYER CONFIGURATION REQUIRED
        </p>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#142B49] mt-1">
          Connect Your Supabase Project
        </h1>
        <p className="text-xs sm:text-sm text-[#4F627A] mt-2 leading-relaxed">
          Multiplayer event creation, joining codes, live progress tracking, and leaderboard ranking require an active Supabase connection.
        </p>

        <ol className="mt-5 space-y-3 text-xs sm:text-sm text-[#142B49]">
          <li className="rounded-xl bg-[#F5F7FA] border border-[#DCE3EC] p-3">
            <span className="font-bold">1. Run the database schema</span>
            <p className="text-[#4F627A] mt-0.5 text-xs leading-relaxed">
              Open your Supabase project&apos;s SQL Editor and run{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DCE3EC]">
                supabase/schema.sql
              </code>{' '}
              (or{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DCE3EC]">
                supabase/migrations/003_public_code_management.sql
              </code>{' '}
              if upgrading) to set up tables, Row Level Security, joining/management codes, and Realtime.
            </p>
          </li>

          <li className="rounded-xl bg-[#F5F7FA] border border-[#DCE3EC] p-3">
            <span className="font-bold">2. Set environment variables</span>
            <p className="text-[#4F627A] mt-0.5 text-xs leading-relaxed">
              Add{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DCE3EC]">
                VITE_SUPABASE_URL
              </code>{' '}
              and{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DCE3EC]">
                VITE_SUPABASE_ANON_KEY
              </code>{' '}
              to <code className="font-mono">.env</code> or your Vercel project Environment Variables. Never expose a <code className="font-mono">service_role</code> key in frontend variables.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
};
