import { supabase } from '../../../../lib/supabase';
import { signToken } from '../../../../lib/jwt';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return NextResponse.json({ error: 'Email dan password harus diisi' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const password_hash = await bcrypt.hash(password, 10);

    // Rely on the UNIQUE(email) constraint instead of check-then-insert (race-free)
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: normalizedEmail, password_hash })
      .select('id, email')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
      }
      console.error('signup error:', error);
      return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 });
    }

    const token = signToken({ id: user.id, email: user.email });

    return NextResponse.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('signup error:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
