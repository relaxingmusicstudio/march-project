/**
 * Placeholder Scanner - Detects placeholders and "false done" patterns
 * Prevents loops by catching common code smells before claiming completion
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Copy, AlertTriangle, XCircle, CheckCircle2, 
  Loader2, FileCode, Play, Info, Download
} from "lucide-react";
import { toast } from "sonner";
import { PlatformStatusBanner } from "@/components/platform/PlatformStatusBanner";

interface Finding {
  severity: "critical" | "warning";
  pattern: string;
  file: string;
  line: number;
  snippet: string;
}

interface ScanResult {
  ok: boolean;
  scanned: number;
  findings: Finding[];
  summary: { critical: number; warning: number };
  duration_ms: number;
}

// Quick scan targets - most important files to check
const QUICK_SCAN_FILES = [
  "src/App.tsx",
  "src/hooks/useRoleNavigation.ts",
  "src/pages/platform/ToolsHub.tsx",
  "src/lib/toolRegistry.ts",
  "src/components/ProtectedRoute.tsx",
];

// Demo content with intentional issues for testing
const DEMO_CONTENT = `[
  {
    "file": "demo/TestFile.tsx",
    "content": "import React from 'react';\\n// TODO: REMOVE this before release\\nconst PLACEHOLDER = 'change me';\\nexport const Demo = () => {\\n  console.log('debug');\\n  return <div } />;\\n};"
  }
]`;

export default function PlaceholderScan() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [sourceBundle, setSourceBundle] = useState("");
  const [activeTab, setActiveTab] = useState<"paste" | "demo">("paste");
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const edgeUrl = `${supabaseUrl}/functions/v1/placeholder-scan`;

  const runScan = async (files: { file: string; content: string }[]) => {
    setScanning(true);
    setResult(null);

    try {
      const response = await fetch(edgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, mode: "full" }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.message || "Scan failed");
        return;
      }

      setResult(data);
      
      if (data.ok) {
        toast.success(`Scan complete: No critical issues in ${data.scanned} files`);
      } else {
        toast.warning(`Found ${data.summary.critical} critical issues`);
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Failed to run scan");
    } finally {
      setScanning(false);
    }
  };

  const handlePasteScan = () => {
    try {
      const files = JSON.parse(sourceBundle);
      if (!Array.isArray(files)) {
        toast.error("Input must be a JSON array");
        return;
      }
      runScan(files);
    } catch {
      toast.error("Invalid JSON format");
    }
  };

  const handleDemoScan = () => {
    const files = JSON.parse(DEMO_CONTENT);
    setSourceBundle(DEMO_CONTENT);
    runScan(files);
  };

  const copyFindings = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast.success("Findings copied to clipboard");
  };

  const copyFinding = (finding: Finding) => {
    navigator.clipboard.writeText(`${finding.file}:${finding.line} - ${finding.pattern}\n${finding.snippet}`);
    toast.success("Finding copied");
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placeholder-scan-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <PlatformStatusBanner />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-6 w-6" />
            Placeholder Scanner
          </CardTitle>
          <CardDescription>
            Detect placeholders, stubs, and "false done" patterns in source files.
            Prevents loops by catching code smells before claiming completion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "paste" | "demo")}>
            <TabsList>
              <TabsTrigger value="paste">Paste Source Bundle</TabsTrigger>
              <TabsTrigger value="demo">Demo Scan</TabsTrigger>
            </TabsList>
            
            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Paste a JSON array of files to scan. Format: <code>[{`{file: "path", content: "..."}`}]</code>
                </p>
                <Textarea
                  value={sourceBundle}
                  onChange={(e) => setSourceBundle(e.target.value)}
                  placeholder={`[\n  { "file": "src/App.tsx", "content": "// file content here" }\n]`}
                  className="font-mono text-xs h-48"
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePasteScan} 
                    disabled={scanning || !sourceBundle.trim()}
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Run Scan
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="demo" className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Demo Mode</AlertTitle>
                <AlertDescription>
                  Run a scan on sample content with intentional issues to see how the scanner works.
                </AlertDescription>
              </Alert>
              <Button onClick={handleDemoScan} disabled={scanning}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Run Demo Scan
              </Button>
            </TabsContent>
          </Tabs>

          {/* Quick Scan Files Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Recommended Files to Scan:</h4>
            <div className="flex flex-wrap gap-2">
              {QUICK_SCAN_FILES.map((file) => (
                <Badge key={file} variant="outline" className="font-mono text-xs">
                  <FileCode className="h-3 w-3 mr-1" />
                  {file}
                </Badge>
              ))}
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  {result.ok ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {result.ok ? "No Critical Issues" : "Issues Found"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Scanned {result.scanned} files in {result.duration_ms}ms
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">{result.summary.critical}</div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">{result.summary.warning}</div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyFindings}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Findings JSON
                </Button>
                <Button variant="outline" size="sm" onClick={downloadReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              </div>

              {/* Findings Table */}
              {result.findings.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Severity</TableHead>
                        <TableHead className="w-48">File</TableHead>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead className="w-48">Pattern</TableHead>
                        <TableHead>Snippet</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.findings.map((finding, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {finding.severity === "critical" ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Critical
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700">
                                <AlertTriangle className="h-3 w-3" />
                                Warning
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{finding.file}</TableCell>
                          <TableCell className="font-mono">{finding.line}</TableCell>
                          <TableCell className="text-sm">{finding.pattern}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[300px] truncate">
                            {finding.snippet}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => copyFinding(finding)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pattern Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detected Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Critical Patterns
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Malformed JSX: <code>{"}/>"}</code> or <code>{" } />"}</code></li>
                <li>• REPLACE_ME, CHANGE_ME, PLACEHOLDER</li>
                <li>• TODO: REMOVE, TEMP, stub, mock</li>
                <li>• Route with null element</li>
                <li>• Import from placeholder path</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-yellow-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warning Patterns
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• TODO, FIXME, HACK comments</li>
                <li>• (undefined), (not set) in strings</li>
                <li>• <code>as any</code> type assertions</li>
                <li>• console.log / console.error</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
