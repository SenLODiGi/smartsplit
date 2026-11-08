import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  console.log('--- 1. Testing Auth User ---');
  // Attempt to sign in or sign up a test onboarding user
  const testEmail = `test_onboarding_${Date.now()}@example.com`;
  const testPass = 'Password123!';

  console.log(`Signing up test user: ${testEmail}`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: testPass,
    options: {
      data: { name: 'Test Onboarding User' }
    }
  });

  if (signUpErr) {
    console.error('SignUp Error:', signUpErr.message);
  }

  const user = signUpData?.user;
  const session = signUpData?.session;
  console.log('User created:', user?.id, 'Session exists:', Boolean(session));

  if (!session) {
    console.log('Supabase requires email confirmation or no session returned on signUp!');
    // Let's try signing in existing user if any
    return;
  }

  console.log('--- 2. Checking Profile creation ---');
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  console.log('Profile exists:', profile, 'Error:', profErr?.message);

  if (!profile) {
    console.log('Attempting to create profile manually...');
    const { data: insProf, error: insProfErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: 'Test Onboarding User',
        full_name: 'Test Onboarding User'
      })
      .select()
      .maybeSingle();
    console.log('Manual profile insert result:', insProf, 'Error:', insProfErr?.message);
  }

  console.log('--- 3. Testing Group Insert ---');
  const { data: grp, error: grpErr } = await supabase
    .from('groups')
    .insert({
      name: 'Test Onboarding Group',
      currency: 'LKR',
      category: 'trip',
      created_by: user.id
    })
    .select()
    .single();

  console.log('Group insert result:', grp, 'Error:', grpErr?.message);

  if (!grp) {
    console.error('Cannot proceed without group');
    return;
  }

  console.log('--- 4. Testing Group Members Insert (The Failing Step!) ---');
  const { data: gm, error: gmErr } = await supabase
    .from('group_members')
    .insert({
      group_id: grp.id,
      user_id: user.id,
      role: 'admin'
    })
    .select();

  console.log('Group member insert result:', gm, 'Error:', gmErr);

  console.log('--- 5. Testing RPC create_group_with_creator ---');
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_group_with_creator', {
    p_name: 'RPC Onboarding Group',
    p_description: 'Created via RPC',
    p_currency: 'LKR',
    p_category: 'trip',
    p_cover_gradient: 'from-blue-600 to-indigo-800',
    p_member_names: ['Member A', 'Member B']
  });

  console.log('RPC result:', rpcRes, 'RPC Error:', rpcErr);
}

diagnose();
