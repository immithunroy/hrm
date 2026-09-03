/**
 * EmployeesPage - Employee listing and management page.
 *
 * Features:
 * - Paginated employee table with search functionality
 * - Debounced search input (300ms delay) to reduce API calls
 * - Employee status badges with color coding
 * - Quick actions: View detail, Edit employee
 * - Add new employee button
 * - Responsive table layout
 *
 * State management:
 * - Debounced search with useRef timer to avoid excessive re-renders
 * - Server-side pagination via page/limit query params
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  Pagination,
  PaginationContent,
  PaginationList,
  PaginationItem,
  PaginationPrevious,
  PaginationNext
} from '@/components/ui';
import { EMPLOYEE_STATUS_STYLES } from '../../lib/colors';

const EmployeesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage)
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await api.get<any>(`/employees?${params.toString()}`);
      setEmployees(res.data.employees || []);
      setTotalEmployees(res.data.pagination?.total || 0);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, currentPage, itemsPerPage]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  if (!user) {
    return <div>Loading...</div>;
  }

  const totalPages = Math.max(1, Math.ceil(totalEmployees / itemsPerPage));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <CardHeader>
          <h2 className="text-xl font-bold">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage your team members</p>
        </CardHeader>
        
        <div className="flex gap-3">
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs"
          />
          <Button onClick={() => navigate('/employees/new')}>
            Add Employee
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2">Loading employees...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : (
        <>
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No employees found</p>
              {search && (
                <p className="mt-2">Try adjusting your search criteria</p>
              )}
            </div>
          ) : (
            <>
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Employee ID</TableHead>
                        <TableHead className="w-32">Email</TableHead>
                        <TableHead className="w-24">Department</TableHead>
                        <TableHead className="w-24">Position</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(employee => (
                        <TableRow key={employee.id}>
                          <TableCell>{employee.employeeId}</TableCell>
                          <TableCell>
                            <div
                              className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                              onClick={() => navigate(`/employees/${employee.id}`)}
                            >
                              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                {employee.firstName.charAt(0)}{employee.lastName?.charAt(0) || ''}
                              </div>
                              <div>
                                <p className="font-medium hover:underline">{employee.firstName} {employee.lastName}</p>
                                <p className="text-xs text-muted-foreground">{employee.employeeId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{employee.employeeId}</TableCell>
                          <TableCell>{employee.email}</TableCell>
                          <TableCell>{employee.department?.name}</TableCell>
                          <TableCell>{employee.position?.title}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 text-xs rounded-full ${EMPLOYEE_STATUS_STYLES[employee.status] || 'bg-yellow-100 text-yellow-800'}`}>
                              {employee.status}
                            </span>
                          </TableCell>
                          <TableCell className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => navigate(`/employees/${employee.id}`)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => navigate(`/employees/${employee.id}/edit`)}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Showing {employees.length} of {totalEmployees} employees
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationPrevious onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} />
                      <PaginationList>
                        {[...Array(totalPages)].map((_, index) => (
                          <PaginationItem 
                            key={index} 
                            active={index + 1 === currentPage}
                            onClick={() => setCurrentPage(index + 1)}
                          >
                            {index + 1}
                          </PaginationItem>
                        ))}
                      </PaginationList>
                      <PaginationNext onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} />
                    </PaginationContent>
                  </Pagination>
                </CardFooter>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EmployeesPage;