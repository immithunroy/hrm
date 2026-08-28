export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  employeeId?: string;
  role?: string;
}

export interface LoginFormValues {
  username: string;
  password: string;
}

export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
}