import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://djnysigashxtjfhxpzyj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqbnlzaWdhc2h4dGpmaHhwenlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzA0NjYsImV4cCI6MjA4MTMwNjQ2Nn0.VGlScZur5hfByp-vumqzOKZhghwd9TZRQZY6cn869-A";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const testEmail = `test_${Date.now()}@test.com`;
  console.log("Testing Supabase Signup with:", testEmail);
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: 'password123',
    options: {
      data: {
        full_name: 'Test Setup'
      }
    }
  });
  
  if (error) {
    console.log("Signup Error from Supabase:", error.message);
  } else {
    console.log("Signup Success data:", !!data.user);
  }
}

test();
