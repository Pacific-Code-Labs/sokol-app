import { z } from "zod";

/**
 * Shared zod schemas for the auth/profile flows (FCR-060).
 *
 * Validation messages are LangContext dictionary KEYS (e.g. "val_email_required")
 * — resolve them through `tr[...]` at the FormField call site (the FE convention;
 * mirrors how the POS resolved keys through `t()`). The password policy mirrors
 * the AWS Cognito user-pool policy exactly — do NOT weaken it.
 */
export const passwordSchema = z
  .string()
  .min(8, "val_password_min")
  .regex(/[a-z]/, "val_password_lower")
  .regex(/[A-Z]/, "val_password_upper")
  .regex(/[0-9]/, "val_password_number")
  .regex(/[^a-zA-Z0-9]/, "val_password_special");

export const emailSchema = z.string().email("val_email_required");

export const usernameSchema = z
  .string()
  .min(3, "val_username_min")
  .regex(/^[a-zA-Z0-9_-]+$/, "val_username_pattern");

/** Register step 1: identity. Locale comes from the navigation toggle. */
export const registerInfoSchema = z.object({
  firstName: z.string().min(1, "val_first_name_required"),
  lastName: z.string().min(1, "val_last_name_required"),
  username: usernameSchema,
  email: emailSchema,
});

/** Register step 2: password + confirmation. */
export const registerPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "val_passwords_dont_match",
    path: ["confirmPassword"],
  });

export type RegisterInfoForm = z.infer<typeof registerInfoSchema>;
export type RegisterPasswordForm = z.infer<typeof registerPasswordSchema>;
