import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

interface DashboardStats {
  employees: number;
  todayAttendance: number;
  pendingLeaveRequests: number;
  monthlyPayroll: number;
}

interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  time: string;
}

const DashboardScreen = ({ navigation }: Props) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Simulate API calls
      // In a real app, you would fetch from your backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats({
        employees: 24,
        todayAttendance: 22,
        pendingLeaveRequests: 5,
        monthlyPayroll: 85000
      });
      
      setNotifications([
        { id: '1', title: 'Welcome to ZKT Payroll HR', message: 'Thank you for joining our platform!', time: '2 min ago' },
        { id: '2', title: 'System Maintenance', message: 'Maintenance scheduled for tonight at 2 AM UTC.', time: '1 hour ago' }
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#841584" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Overview of your organization</Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Employees</Text>
          <Text style={styles.statValue}>{stats?.employees}</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Today's Attendance</Text>
          <Text style={styles.statValue}>{stats?.todayAttendance}</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending Leave Requests</Text>
          <Text style={styles.statValue}>{stats?.pendingLeaveRequests}</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Monthly Payroll</Text>
          <Text style={styles.statValue}>${stats?.monthlyPayroll.toLocaleString()}</Text>
        </View>
      </View>
      
      <View style={styles.notificationsSection}>
        <Text style={styles.sectionTitle}>Recent Notifications</Text>
        <FlatList
          data={notifications}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.notificationItem}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <Text style={styles.notificationTime}>{item.time}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No notifications</Text>
          }
        />
      </View>
      
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Button title="Logout" onPress={() => navigation.replace('Login')} />
        </View>
      </View>
      
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    padding: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  quickActions: {
    padding: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default DashboardScreen;