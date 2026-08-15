import { describe, it, expect } from 'vitest';
import { passwordSchema, loginSchema, registerSchema } from '@/services/authService';

describe('authService Schemas', () => {
  describe('passwordSchema', () => {
    it('should validate compliant passwords', () => {
      const res = passwordSchema.safeParse('SecurePass123');
      expect(res.success).toBe(true);
    });

    it('should reject passwords shorter than 8 chars', () => {
      const res = passwordSchema.safeParse('Abc1');
      expect(res.success).toBe(false);
    });

    it('should reject passwords without numbers or uppercase letters', () => {
      expect(passwordSchema.safeParse('onlylowercase').success).toBe(false);
      expect(passwordSchema.safeParse('ONLYUPPERCASE123').success).toBe(false);
      expect(passwordSchema.safeParse('NoDigitsPassword').success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid email or username and password', () => {
      expect(loginSchema.safeParse({ emailOrUsername: 'admin@fares.ly', password: 'Password1' }).success).toBe(true);
      expect(loginSchema.safeParse({ emailOrUsername: 'admin_user', password: 'Password1' }).success).toBe(true);
    });

    it('should reject empty credentials', () => {
      expect(loginSchema.safeParse({ emailOrUsername: '', password: '' }).success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('should validate full registration input', () => {
      const valid = {
        email: 'newuser@fares.ly',
        password: 'StrongPassword1',
        name: 'أحمد علي',
        username: 'ahmed_ali',
        phone: '0912345678'
      };
      expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'StrongPassword1',
        name: 'أحمد'
      };
      expect(registerSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
