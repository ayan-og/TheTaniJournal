import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/");
      return;
    }
    loadStats();
    loadReports();
  }, [user, navigate]);

  const loadStats = async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch (e) {
      toast.error("Failed to load stats");
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/reports");
      setReports(data.items || []);
    } catch (e) {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (reportId, action, reason = "") => {
    try {
      await api.post(`/admin/reports/${reportId}/resolve`, { action, reason });
      toast.success("Report resolved");
      loadReports();
    } catch (e) {
      toast.error("Failed to resolve report");
    }
  };

  if (!stats) return <div className="px-6 py-20 text-center">Loading...</div>;

  return (
    <div className="px-6 md:px-12 py-12 md:py-16">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-serif text-4xl mb-8">Admin Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">Users</div>
            <div className="text-3xl font-bold mt-2">{stats.total_users}</div>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">Posts</div>
            <div className="text-3xl font-bold mt-2">{stats.total_posts}</div>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">Comments</div>
            <div className="text-3xl font-bold mt-2">{stats.total_comments}</div>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">Reports</div>
            <div className="text-3xl font-bold mt-2">{stats.total_reports}</div>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">Explicit</div>
            <div className="text-3xl font-bold mt-2">{stats.explicit_posts}</div>
          </div>
          <div className="p-6 bg-card border border-border rounded-lg">
            <div className="text-sm text-secondary uppercase tracking-wider">18+ Posts</div>
            <div className="text-3xl font-bold mt-2">{stats.adult_posts}</div>
          </div>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList>
            <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
            <TabsTrigger value="users">Recent Users</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-6">
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="text-secondary text-center py-8">No reports</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="p-4 border border-border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.type}: {r.target_id}</p>
                        <p className="text-xs text-secondary mt-1">Reason: {r.reason}</p>
                        <p className="text-xs text-secondary">Reporter: {r.reporter_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline">Dismiss</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Dismiss Report?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resolveReport(r.id, "dismiss")}>Dismiss</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive">Delete</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Content?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove the reported content.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resolveReport(r.id, r.type === "post" ? "delete_post" : "delete_comment")}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <div className="space-y-2">
              {stats.recent_users?.map((u) => (
                <div key={u.user_id} className="p-3 border border-border rounded-lg text-sm">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-secondary">{u.email}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
