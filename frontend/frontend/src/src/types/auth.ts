export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId?: string;
  role?: string;
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}