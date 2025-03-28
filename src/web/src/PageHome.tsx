import { SuiClient } from '@mysten/sui/client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Flex,
  Grid,
  GridItem,
  Heading,
  Progress,
  Radio,
  RadioGroup,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  Badge,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  Code,
  useClipboard,
  IconButton,
  Tooltip,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  StatGroup,
  Switch,
  FormControl,
  FormLabel,
  Divider,
  Alert,
  AlertIcon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tag,
  HStack,
  ButtonGroup
} from '@chakra-ui/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  BarElement
} from 'chart.js';
import { Line, Pie, Radar, Bar } from 'react-chartjs-2';
import {
  FaCopy,
  FaDownload,
  FaRedo,
  FaMapMarkerAlt,
  FaSyncAlt,
  FaChartLine,
  FaInfoCircle,
  FaCodeBranch,
  FaChevronDown
} from 'react-icons/fa';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

import {
  RPC_ENDPOINTS,
  RpcLatencyResult,
  generateRandomAddress,
  measureRpcLatency
} from '@polymedia/suitcase-core';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  ChartTooltip,
  Legend
);

// Extended with health and reliability metrics
export interface RpcHealth {
  url: string;
  uptime: number; // percentage
  reliability: number; // percentage
  avgLatency: number;
  lastChecked: Date;
  responseSuccess: number; // count
  responseFailure: number; // count
  region?: string;
  provider?: string;
  healthScore?: number; // calculated health score
  healthHistory: number[]; // array of past health scores
  latencyHistory: number[]; // array of past latency measurements
  testResults: TestResult[];
  // New fields for enhanced monitoring
  currentLoad: number;
  concurrentConnections: number;
  lastErrorTimestamp?: Date;
  lastErrorMessage?: string;
  performanceScore: {
    latency: number;
    reliability: number;
    consistency: number;
    total: number;
  };
  websocketStatus: 'connected' | 'disconnected' | 'error';
  nodeVersion?: string;
  capabilities: string[];
}

export interface TestResult {
  timestamp: Date;
  testType: string;
  latency: number;
  success: boolean;
  errorMessage?: string;
}

// Add WebSocket monitoring class
class RpcMonitor {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private onHealthUpdate: (health: RpcHealth) => void;

  constructor(url: string, onHealthUpdate: (health: RpcHealth) => void) {
    this.url = url.replace('https://', 'wss://');
    this.onHealthUpdate = onHealthUpdate;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHealthChecks();
      };

      this.ws.onmessage = event => {
        const health = JSON.parse(event.data);
        this.onHealthUpdate(health);
      };

      this.ws.onerror = error => {
        console.error(`WebSocket error for ${this.url}:`, error);
        this.reconnect();
      };

      this.ws.onclose = () => {
        this.reconnect();
      };
    } catch (error) {
      console.error(`Failed to connect to ${this.url}:`, error);
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(
        () => this.connect(),
        1000 * Math.pow(2, this.reconnectAttempts)
      );
    }
  }

  private startHealthChecks() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel: 'health' }));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const PageHome: React.FC = () => {
  // Toast notifications
  const toast = useToast();

  // Core test config
  const network = 'mainnet';
  const numRounds = 11; // first round discarded (DNS/TLS overhead)

  // Track RPC endpoints and their enabled status
  const [rpcs, setRpcs] = useState<RpcUrl[]>(
    RPC_ENDPOINTS[network].map(url => ({ url, enabled: true }))
  );

  // Test type determines which RPC method to benchmark
  const [testType, setTestType] = useState<
    'multiGetObjects' | 'queryTransactionBlocks'
  >('multiGetObjects');

  const [results, setResults] = useState<AggregateResult[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [historicalData, setHistoricalData] = useState<{
    [endpoint: string]: number[];
  }>({});

  // New state variables for enhanced functionality
  const [activeTab, setActiveTab] = useState<number>(0);
  const [healthData, setHealthData] = useState<RpcHealth[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(300000); // 5 minutes
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('24h');
  const [userRegion, setUserRegion] = useState<string>('');
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(false);
  const [checkAllComplete, setCheckAllComplete] = useState<boolean>(false);
  const [regionRecommendations, setRegionRecommendations] = useState<{
    [region: string]: string;
  }>({});
  const [showAdvancedOptions, setShowAdvancedOptions] =
    useState<boolean>(false);
  const [loadTestSize, setLoadTestSize] = useState<number>(50); // Number of concurrent requests for load testing

  // Generated code snippets for developer integration
  const [codeLanguage, setCodeLanguage] = useState<string>('typescript');

  // Code snippet clipboard
  const { onCopy: onCopyTypeScript, hasCopied: hasCopiedTypeScript } =
    useClipboard('');

  // Mock provider information - in a real app this would come from a database or API
  const providerInfo: { [url: string]: { name: string; region: string } } = {
    'https://fullnode.mainnet.sui.io': { name: 'Mysten Labs', region: 'US' },
    'https://sui-mainnet.public.blastapi.io': { name: 'Blast', region: 'EU' },
    'https://sui-mainnet-rpc.allthatnode.com': {
      name: 'AllThatNode',
      region: 'US'
    },
    'https://sui-mainnet-us-1.cosmostation.io': {
      name: 'Cosmostation',
      region: 'US'
    },
    'https://mainnet.sui.chainbase.online': { name: 'ChainBase', region: 'EU' },
    'https://sui-rpc-mainnet.testnet-pride.com': {
      name: 'TestnetPride',
      region: 'EU'
    },
    'https://sui-mainnet-us-2.cosmostation.io': {
      name: 'Cosmostation',
      region: 'US'
    },
    'https://sui-mainnet-rpc.bartestnet.com': {
      name: 'BAR Validator',
      region: 'US'
    },
    'https://mainnet-sui.rpcpool.com': { name: 'RPC Pool', region: 'Global' },
    'https://mainnet.suiet.app': { name: 'Suiet', region: 'US' }
  };

  // Test type descriptions
  const testTypeInfo = {
    multiGetObjects: {
      title: 'Multi-Object Retrieval',
      description:
        'Tests how quickly the RPC can fetch multiple objects in parallel. Useful for dApps that need to load many objects at once.',
      details:
        'Fetches 20 random objects with full content, type, and display data.'
    },
    queryTransactionBlocks: {
      title: 'Transaction Query',
      description:
        'Tests basic transaction retrieval performance. Useful for explorers, wallets, and analytics tools.',
      details:
        'Retrieves the most recent transactions with their effects and inputs.'
    }
  };

  // Add to component state
  const [monitors, setMonitors] = useState<Map<string, RpcMonitor>>(new Map());
  const [realTimeHealth, setRealTimeHealth] = useState<Map<string, RpcHealth>>(
    new Map()
  );

  const runTest = async () => {
    // Validate that at least one RPC is enabled
    if (!rpcs.some(rpc => rpc.enabled)) {
      toast({
        title: 'Error',
        description: 'Please select at least one RPC endpoint to test.',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    setIsRunning(true);
    setProgress((0.5 / numRounds) * 100);

    const allResults: RpcLatencyResult[][] = [];
    const endpoints = rpcs.filter(rpc => rpc.enabled).map(rpc => rpc.url);

    // Define the RPC call to benchmark based on test type
    const rpcRequest = async (client: SuiClient) => {
      if (testType === 'multiGetObjects') {
        // Test object retrieval with 20 random addresses
        await client.multiGetObjects({
          ids: Array.from({ length: 20 }, () => generateRandomAddress()),
          options: { showContent: true, showType: true, showDisplay: true }
        });
      } else if (testType === 'queryTransactionBlocks') {
        // Test tx query using a simpler approach that's less likely to fail
        try {
          await client.queryTransactionBlocks({
            limit: 10,
            order: 'descending',
            options: {
              showEffects: true,
              showInput: true
            }
          });
        } catch (error) {
          console.error('Error in transaction query:', error);
          // Fall back to a simpler query if the first one fails
          await client.getLatestCheckpointSequenceNumber();
        }
      }
    };

    // Run multiple rounds of latency tests
    try {
      for (let i = 0; i < numRounds; i++) {
        try {
          const newResults = await measureRpcLatency({ endpoints, rpcRequest });
          allResults.push(newResults);
        } catch (error) {
          console.error(`Error in test round ${i}:`, error);
          // Create placeholder results with errors for all endpoints
          allResults.push(
            endpoints.map(endpoint => ({ endpoint, latency: undefined }))
          );
        }
        setProgress(((i + 1.5) / numRounds) * 100);
      }

      // Process results, skipping first round
      const aggregateResults: AggregateResult[] = endpoints.map(
        (endpoint, i) => {
          const latencies: number[] = [];
          let hasError = false;

          // Skip round 0, collect remaining latencies
          for (let round = 1; round < numRounds; round++) {
            const result = allResults[round][i];
            if (result.latency !== undefined) {
              latencies.push(result.latency);
            } else {
              hasError = true;
              break;
            }
          }

          if (!hasError && latencies.length > 0) {
            return {
              endpoint,
              average: calculateAverage(latencies),
              p50: calculatePercentile(latencies, 0.5),
              p90: calculatePercentile(latencies, 0.9),
              error: false
            };
          } else {
            return {
              endpoint,
              average: NaN,
              p50: NaN,
              p90: NaN,
              error: true
            };
          }
        }
      );

      // Sort: working endpoints first, then by average latency
      aggregateResults.sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        return a.average - b.average;
      });

      // Update historical data for chart
      const newHistoricalData = { ...historicalData };
      aggregateResults.forEach(result => {
        if (!result.error) {
          const endpointHistory = newHistoricalData[result.endpoint] || [];
          if (endpointHistory.length >= 10) {
            endpointHistory.shift(); // Remove oldest data point if we have 10 already
          }
          endpointHistory.push(result.average);
          newHistoricalData[result.endpoint] = endpointHistory;
        }
      });
      setHistoricalData(newHistoricalData);

      setResults(aggregateResults);

      toast({
        title: 'Test Complete',
        description: 'RPC testing completed successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred during testing',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Toggle RPC endpoint selection
  const onRpcCheckboxChange = (url: string) => {
    setRpcs(prevRpcs =>
      prevRpcs.map(rpc =>
        rpc.url !== url ? rpc : { ...rpc, enabled: !rpc.enabled }
      )
    );
  };

  // Prepare chart data
  const chartData = {
    labels: [...Array(10).keys()].map(i => `Test ${i + 1}`),
    datasets: Object.entries(historicalData)
      .filter(([_, data]) => data.length > 0)
      .map(([endpoint, data], index) => {
        // Generate color based on index
        const hue = (index * 137) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;

        return {
          label: endpoint.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          data,
          borderColor: color,
          backgroundColor: `hsla(${hue}, 70%, 60%, 0.1)`,
          tension: 0.2
        };
      })
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white'
        }
      },
      title: {
        display: true,
        text: 'RPC Latency History (ms)',
        color: 'white'
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}ms`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)'
        }
      }
    }
  };

  // Effect for detecting user's region
  useEffect(() => {
    const detectUserRegion = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setUserRegion(data.continent_code || 'Unknown');
      } catch (error) {
        console.error('Error detecting user region:', error);
        setUserRegion('Unknown');
      }
    };

    detectUserRegion();
  }, []);

  // Effect for auto-refresh functionality
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (autoRefresh && !isRunning) {
      intervalId = setInterval(() => {
        runTest();
      }, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, refreshInterval, isRunning]);

  // Initialize health data on first load
  useEffect(() => {
    if (healthData.length === 0) {
      initializeHealthData();
    }
  }, []);

  const initializeHealthData = () => {
    // Create initial health data for all RPC endpoints
    const initialHealthData: RpcHealth[] = rpcs.map(rpc => ({
      url: rpc.url,
      uptime: 100,
      reliability: 100,
      avgLatency: 0,
      lastChecked: new Date(),
      responseSuccess: 0,
      responseFailure: 0,
      region: providerInfo[rpc.url]?.region || 'Unknown',
      provider: providerInfo[rpc.url]?.name || 'Unknown',
      healthScore: 100,
      healthHistory: Array(10).fill(100),
      latencyHistory: Array(10).fill(0),
      testResults: [],
      currentLoad: 0,
      concurrentConnections: 0,
      performanceScore: {
        latency: 0,
        reliability: 0,
        consistency: 0,
        total: 0
      },
      websocketStatus: 'disconnected',
      capabilities: []
    }));

    setHealthData(initialHealthData);
  };

  // Function to perform comprehensive health checks on all RPC endpoints
  const checkAllEndpointsHealth = async () => {
    if (isHealthChecking) return;

    setIsHealthChecking(true);
    setCheckAllComplete(false);

    const updatedHealthData = [...healthData];
    const testTimestamp = new Date();

    for (const rpcHealth of updatedHealthData) {
      try {
        // Basic connection test
        const client = new SuiClient({ url: rpcHealth.url });
        const startTime = performance.now();
        const result = await client.getLatestCheckpointSequenceNumber();
        const endTime = performance.now();
        const latency = endTime - startTime;

        // Update health metrics
        rpcHealth.lastChecked = testTimestamp;
        rpcHealth.avgLatency =
          (rpcHealth.avgLatency * rpcHealth.responseSuccess + latency) /
          (rpcHealth.responseSuccess + 1);
        rpcHealth.responseSuccess += 1;

        // Calculate health score (simple algorithm - can be improved)
        const reliabilityFactor =
          rpcHealth.responseSuccess /
          (rpcHealth.responseSuccess + rpcHealth.responseFailure);
        const latencyFactor = Math.max(0, 1 - latency / 2000); // Penalize latency over 2000ms
        rpcHealth.healthScore = Math.round(
          (reliabilityFactor * 0.7 + latencyFactor * 0.3) * 100
        );

        // Update history arrays
        rpcHealth.latencyHistory = [
          ...rpcHealth.latencyHistory.slice(-9),
          latency
        ];
        rpcHealth.healthHistory = [
          ...rpcHealth.healthHistory.slice(-9),
          rpcHealth.healthScore
        ];

        // Add test result
        rpcHealth.testResults.push({
          timestamp: testTimestamp,
          testType: 'connection',
          latency: latency,
          success: true
        });

        // Update uptime and reliability
        const totalChecks =
          rpcHealth.responseSuccess + rpcHealth.responseFailure;
        rpcHealth.uptime = (rpcHealth.responseSuccess / totalChecks) * 100;

        // More complex reliability calculation taking into account recent performance
        const recentTests = rpcHealth.testResults.slice(-20);
        const recentSuccesses = recentTests.filter(test => test.success).length;
        rpcHealth.reliability =
          recentTests.length > 0
            ? (recentSuccesses / recentTests.length) * 100
            : 100;
      } catch (error) {
        // Handle failure
        rpcHealth.responseFailure += 1;
        rpcHealth.lastChecked = testTimestamp;

        // Update test results
        rpcHealth.testResults.push({
          timestamp: testTimestamp,
          testType: 'connection',
          latency: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        // Update health metrics
        const totalChecks =
          rpcHealth.responseSuccess + rpcHealth.responseFailure;
        rpcHealth.uptime = (rpcHealth.responseSuccess / totalChecks) * 100;

        // More significant penalty for recent failures
        rpcHealth.healthScore = Math.max(0, rpcHealth.healthScore - 20);
        rpcHealth.healthHistory = [
          ...rpcHealth.healthHistory.slice(-9),
          rpcHealth.healthScore
        ];
      }
    }

    // Generate region-based recommendations
    const regionRPCs: { [region: string]: RpcHealth[] } = {};
    updatedHealthData.forEach(rpc => {
      if (!regionRPCs[rpc.region]) regionRPCs[rpc.region] = [];
      regionRPCs[rpc.region].push(rpc);
    });

    const newRecommendations: { [region: string]: string } = {};
    Object.entries(regionRPCs).forEach(([region, rpcs]) => {
      // Sort by health score and latency
      const sortedRPCs = [...rpcs].sort((a, b) => {
        if (b.healthScore !== a.healthScore)
          return b.healthScore - a.healthScore;
        return a.avgLatency - b.avgLatency;
      });

      if (sortedRPCs.length > 0) {
        newRecommendations[region] = sortedRPCs[0].url;
      }
    });

    setRegionRecommendations(newRecommendations);
    setHealthData(updatedHealthData);
    setIsHealthChecking(false);
    setCheckAllComplete(true);

    toast({
      title: 'Health Check Complete',
      description: 'RPC health metrics have been updated.',
      status: 'success',
      duration: 3000,
      isClosable: true
    });
  };

  // Generate code snippets for the fastest RPC
  const generateCodeSnippet = (language: string): string => {
    if (results.length === 0)
      return '// Run a test first to get the fastest RPC';

    const fastestRPC = results.find(result => !result.error);
    if (!fastestRPC) return '// No working RPCs found in the latest test';

    switch (language) {
      case 'typescript':
        return `// Using the fastest RPC endpoint: ${fastestRPC.endpoint}
import { SuiClient } from '@mysten/sui/client';

// Initialize with the fastest RPC (tested ${new Date().toLocaleString()})
const client = new SuiClient({
  url: "${fastestRPC.endpoint}"
});

// For production, consider using the auto-selection utility
// import { newLowLatencySuiClient } from '@polymedia/suitcase-core';
// const client = await newLowLatencySuiClient({ network: 'mainnet' });`;

      case 'javascript':
        return `// Using the fastest RPC endpoint: ${fastestRPC.endpoint}
const { SuiClient } = require('@mysten/sui/client');

// Initialize with the fastest RPC (tested ${new Date().toLocaleString()})
const client = new SuiClient({
  url: "${fastestRPC.endpoint}"
});

// For production, consider using the auto-selection utility
// const { newLowLatencySuiClient } = require('@polymedia/suitcase-core');
// async function initClient() {
//   return await newLowLatencySuiClient({ network: 'mainnet' });
// }`;

      case 'python':
        return `# Using the fastest RPC endpoint: ${fastestRPC.endpoint}
# Using pysui client library (pip install pysui)
from pysui.sui.client import SuiClient
from pysui.sui.sui_config import SuiConfig

# Initialize with the fastest RPC (tested ${new Date().toLocaleString()})
config = SuiConfig.user_config()
config.rpc_url = "${fastestRPC.endpoint}"
client = SuiClient(config)`;

      case 'rust':
        return `// Using the fastest RPC endpoint: ${fastestRPC.endpoint}
use sui_sdk::SuiClientBuilder;

async fn create_sui_client() -> Result<SuiClient, anyhow::Error> {
    // Initialize with the fastest RPC (tested ${new Date().toLocaleString()})
    let sui_client = SuiClientBuilder::default()
        .build("${fastestRPC.endpoint}")
        .await?;
    
    Ok(sui_client)
}`;

      default:
        return '// Unsupported language selected';
    }
  };

  // Add initialization effect
  useEffect(() => {
    // Initialize monitors for enabled RPCs
    rpcs.forEach(rpc => {
      if (rpc.enabled && !monitors.has(rpc.url)) {
        const monitor = new RpcMonitor(rpc.url, health => {
          setRealTimeHealth(prev => new Map(prev).set(rpc.url, health));
        });
        setMonitors(prev => new Map(prev).set(rpc.url, monitor));
      }
    });

    // Cleanup function
    return () => {
      monitors.forEach(monitor => monitor.disconnect());
    };
  }, [rpcs]);

  // Add health score calculation
  const calculateHealthScore = (health: RpcHealth): number => {
    const latencyScore = Math.max(0, 100 - health.avgLatency);
    const reliabilityScore = health.reliability;
    const uptimeScore = health.uptime;

    return latencyScore * 0.4 + reliabilityScore * 0.3 + uptimeScore * 0.3;
  };

  // Add to component state
  const [geoLatencyData, setGeoLatencyData] = useState<GeoLatencyData[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<
    [number, number] | null
  >(null);

  // Add geolocation effect
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserCoordinates([
            position.coords.latitude,
            position.coords.longitude
          ]);
        },
        error => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Add geographic analysis function
  const analyzeGeographicPerformance = async () => {
    const geoData: GeoLatencyData[] = [];

    // Group endpoints by region
    const regionEndpoints: { [key: string]: string[] } = {};
    rpcs.forEach(rpc => {
      if (rpc.enabled) {
        const provider = providerInfo[rpc.url];
        if (provider?.region) {
          if (!regionEndpoints[provider.region]) {
            regionEndpoints[provider.region] = [];
          }
          regionEndpoints[provider.region].push(rpc.url);
        }
      }
    });

    // Calculate average latency and reliability for each region
    for (const [region, endpoints] of Object.entries(regionEndpoints)) {
      const regionLatencies: number[] = [];
      const regionReliability: number[] = [];

      for (const endpoint of endpoints) {
        const health = realTimeHealth.get(endpoint);
        if (health) {
          regionLatencies.push(health.avgLatency);
          regionReliability.push(health.reliability);
        }
      }

      if (regionLatencies.length > 0) {
        geoData.push({
          region,
          coordinates: regionCoordinates[region] || [0, 0],
          latency:
            regionLatencies.reduce((a, b) => a + b) / regionLatencies.length,
          reliability:
            regionReliability.reduce((a, b) => a + b) /
            regionReliability.length,
          endpoints
        });
      }
    }

    setGeoLatencyData(geoData);
  };

  // Add geographic visualization component
  const GeographicMap: React.FC = () => {
    if (!geoLatencyData.length) return null;

    return (
      <Box h="400px" w="100%" borderRadius="lg" overflow="hidden">
        <MapContainer
          center={userCoordinates || [20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {geoLatencyData.map((data, index) => (
            <CircleMarker
              key={index}
              center={data.coordinates}
              radius={20}
              fillColor={`hsl(${120 - data.latency / 2}, 70%, 50%)`}
              color="#000"
              weight={1}
              opacity={0.8}
              fillOpacity={0.5}
            >
              <Popup>
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">{data.region}</Text>
                  <Text>Avg Latency: {data.latency.toFixed(2)}ms</Text>
                  <Text>
                    Reliability: {(data.reliability * 100).toFixed(1)}%
                  </Text>
                  <Text>Endpoints: {data.endpoints.length}</Text>
                </VStack>
              </Popup>
            </CircleMarker>
          ))}
          {userCoordinates && (
            <CircleMarker
              center={userCoordinates}
              radius={8}
              fillColor="#00f"
              color="#fff"
              weight={2}
              opacity={1}
              fillOpacity={0.7}
            >
              <Popup>Your Location</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </Box>
    );
  };

  // Add to component state
  const [endpointProfiles, setEndpointProfiles] = useState<
    Map<string, EndpointProfile>
  >(new Map());
  const [profilingInProgress, setProfilingInProgress] =
    useState<boolean>(false);

  // Add profiling functions
  const profileEndpoint = async (
    endpoint: string
  ): Promise<EndpointProfile> => {
    const client = new SuiClient({ url: endpoint });
    const profile: EndpointProfile = {
      endpoint,
      provider: providerInfo[endpoint]?.name || 'Unknown',
      region: providerInfo[endpoint]?.region || 'Unknown',
      performance: {
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorRate: 0,
        throughput: 0,
        concurrency: 0
      },
      errors: [],
      recommendations: []
    };

    try {
      // Measure latency distribution
      const latencies: number[] = [];
      const startTime = Date.now();
      const numRequests = 50;
      const concurrentBatches = 5;
      let errors = 0;

      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchPromises = Array.from(
          { length: numRequests / concurrentBatches },
          async () => {
            try {
              const start = performance.now();
              await client.getLatestCheckpointSequenceNumber();
              latencies.push(performance.now() - start);
            } catch (error) {
              errors++;
              profile.errors.push({
                type: error instanceof Error ? error.name : 'Unknown',
                count: 1,
                lastOccurrence: new Date(),
                message:
                  error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        );
        await Promise.all(batchPromises);
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds

      // Calculate performance metrics
      latencies.sort((a, b) => a - b);
      profile.performance = {
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p95Latency: latencies[Math.floor(latencies.length * 0.95)],
        p99Latency: latencies[Math.floor(latencies.length * 0.99)],
        errorRate: errors / numRequests,
        throughput: (numRequests - errors) / duration,
        concurrency: concurrentBatches
      };

      // Generate recommendations
      if (profile.performance.avgLatency > 200) {
        profile.recommendations.push({
          type: 'warning',
          message: 'High average latency detected',
          impact: 'Poor user experience and slower transaction processing',
          action:
            'Consider using a geographically closer endpoint or investigate network issues'
        });
      }

      if (profile.performance.errorRate > 0.1) {
        profile.recommendations.push({
          type: 'critical',
          message: 'High error rate detected',
          impact: 'Unreliable service and potential transaction failures',
          action:
            'Switch to a more reliable endpoint or investigate error causes'
        });
      }

      if (profile.performance.p99Latency > profile.performance.avgLatency * 3) {
        profile.recommendations.push({
          type: 'improvement',
          message: 'High latency variance detected',
          impact: 'Inconsistent user experience',
          action: 'Monitor endpoint stability and consider load balancing'
        });
      }
    } catch (error) {
      console.error(`Failed to profile endpoint ${endpoint}:`, error);
    }

    return profile;
  };

  const runEndpointProfiling = async () => {
    setProfilingInProgress(true);
    const profiles = new Map<string, EndpointProfile>();

    try {
      const enabledEndpoints = rpcs
        .filter(rpc => rpc.enabled)
        .map(rpc => rpc.url);
      const profilingPromises = enabledEndpoints.map(endpoint =>
        profileEndpoint(endpoint)
      );
      const results = await Promise.all(profilingPromises);

      results.forEach(profile => {
        profiles.set(profile.endpoint, profile);
      });

      setEndpointProfiles(profiles);

      toast({
        title: 'Profiling Complete',
        description: `Profiled ${enabledEndpoints.length} endpoints successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: 'Profiling Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to complete profiling',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setProfilingInProgress(false);
    }
  };

  // Add profiling results component
  const EndpointProfilingResults: React.FC = () => {
    return (
      <VStack spacing={4} align="stretch" w="100%">
        {Array.from(endpointProfiles.values()).map((profile, index) => (
          <Card key={index}>
            <CardHeader>
              <Heading size="md">
                {profile.provider} ({profile.region})
              </Heading>
              <Text fontSize="sm" color="gray.500">
                {profile.endpoint}
              </Text>
            </CardHeader>
            <CardBody>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <GridItem>
                  <VStack align="start" spacing={2}>
                    <Stat>
                      <StatLabel>Average Latency</StatLabel>
                      <StatNumber>
                        {profile.performance.avgLatency.toFixed(2)}ms
                      </StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>P95 Latency</StatLabel>
                      <StatNumber>
                        {profile.performance.p95Latency.toFixed(2)}ms
                      </StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>P99 Latency</StatLabel>
                      <StatNumber>
                        {profile.performance.p99Latency.toFixed(2)}ms
                      </StatNumber>
                    </Stat>
                  </VStack>
                </GridItem>
                <GridItem>
                  <VStack align="start" spacing={2}>
                    <Stat>
                      <StatLabel>Error Rate</StatLabel>
                      <StatNumber>
                        {(profile.performance.errorRate * 100).toFixed(1)}%
                      </StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel>Throughput</StatLabel>
                      <StatNumber>
                        {profile.performance.throughput.toFixed(1)} req/s
                      </StatNumber>
                    </Stat>
                  </VStack>
                </GridItem>
              </Grid>

              {profile.errors.length > 0 && (
                <Box mt={4}>
                  <Heading size="sm" mb={2}>
                    Recent Errors
                  </Heading>
                  <VStack align="start" spacing={2}>
                    {profile.errors.map((error, i) => (
                      <Alert key={i} status="error" variant="left-accent">
                        <AlertIcon />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{error.type}</Text>
                          <Text fontSize="sm">{error.message}</Text>
                          <Text fontSize="xs" color="gray.500">
                            Last occurred:{' '}
                            {error.lastOccurrence.toLocaleString()}
                          </Text>
                        </VStack>
                      </Alert>
                    ))}
                  </VStack>
                </Box>
              )}

              {profile.recommendations.length > 0 && (
                <Box mt={4}>
                  <Heading size="sm" mb={2}>
                    Recommendations
                  </Heading>
                  <VStack align="start" spacing={2}>
                    {profile.recommendations.map((rec, i) => (
                      <Alert
                        key={i}
                        status={
                          rec.type === 'critical'
                            ? 'error'
                            : rec.type === 'warning'
                            ? 'warning'
                            : 'info'
                        }
                        variant="left-accent"
                      >
                        <AlertIcon />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold">{rec.message}</Text>
                          <Text fontSize="sm">Impact: {rec.impact}</Text>
                          <Text fontSize="sm">
                            Recommended Action: {rec.action}
                          </Text>
                        </VStack>
                      </Alert>
                    ))}
                  </VStack>
                </Box>
              )}
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };

  return (
    <Grid templateColumns="repeat(12, 1fr)" gap={6}>
      {/* Left Column - Controls */}
      <GridItem colSpan={{ base: 12, md: 5 }}>
        <Card
          bg="blackAlpha.400"
          borderColor="whiteAlpha.100"
          borderWidth="1px"
        >
          <CardHeader>
            <Heading size="md">Select RPC Endpoints</Heading>
          </CardHeader>
          <CardBody>
            <VStack
              align="stretch"
              spacing={2}
              bg="blackAlpha.500"
              p={2}
              borderRadius="md"
              maxH="300px"
              overflowY="auto"
            >
              {rpcs.map(rpc => (
                <Flex
                  key={rpc.url}
                  px={2}
                  py={1}
                  alignItems="center"
                  borderRadius="sm"
                  _hover={{ bg: 'whiteAlpha.100' }}
                >
                  <Checkbox
                    isChecked={rpc.enabled}
                    onChange={() => onRpcCheckboxChange(rpc.url)}
                    colorScheme="blue"
                    mr={3}
                  />
                  <Text fontSize="sm" fontFamily="mono" isTruncated>
                    {rpc.url}
                  </Text>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>

        <Card
          bg="blackAlpha.400"
          mt={6}
          borderColor="whiteAlpha.100"
          borderWidth="1px"
        >
          <CardHeader>
            <Heading size="md">Choose Test Type</Heading>
          </CardHeader>
          <CardBody>
            <RadioGroup
              value={testType}
              onChange={value => setTestType(value as typeof testType)}
            >
              <Stack spacing={5} direction="column">
                {Object.entries(testTypeInfo).map(([type, info]) => (
                  <Box
                    key={type}
                    p={4}
                    bg="blackAlpha.300"
                    borderRadius="md"
                    borderWidth={testType === type ? '1px' : '0px'}
                    borderColor="blue.400"
                    _hover={{ bg: 'blackAlpha.400' }}
                    onClick={() => setTestType(type as typeof testType)}
                    cursor="pointer"
                  >
                    <Flex
                      justifyContent="space-between"
                      alignItems="center"
                      mb={2}
                    >
                      <Radio value={type} colorScheme="blue">
                        <Text fontWeight="bold">{info.title}</Text>
                      </Radio>
                    </Flex>
                    <Text color="gray.300" fontSize="sm" mb={1}>
                      {info.description}
                    </Text>
                    <Text color="gray.500" fontSize="xs">
                      {info.details}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </RadioGroup>

            <Box mt={6}>
              {!isRunning ? (
                <Button
                  colorScheme="blue"
                  width="full"
                  onClick={runTest}
                  isDisabled={isRunning}
                >
                  Start Test
                </Button>
              ) : (
                <Box w="full">
                  <Progress
                    value={progress}
                    size="sm"
                    colorScheme="blue"
                    borderRadius="full"
                    mb={2}
                    isAnimated
                  />
                  <Text textAlign="center" fontSize="sm" color="gray.400">
                    Testing RPC endpoints... {Math.round(progress)}%
                  </Text>
                </Box>
              )}
            </Box>
          </CardBody>
        </Card>
      </GridItem>

      {/* Right Column - Results */}
      <GridItem colSpan={{ base: 12, md: 7 }}>
        {results.length > 0 && (
          <VStack spacing={6} align="stretch">
            <Card
              bg="blackAlpha.400"
              borderColor="whiteAlpha.100"
              borderWidth="1px"
            >
              <CardHeader>
                <Heading size="md">Results</Heading>
              </CardHeader>
              <CardBody>
                <Box overflowX="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Endpoint</Th>
                        <Th isNumeric>AVG (ms)</Th>
                        <Th isNumeric>P50 (ms)</Th>
                        <Th isNumeric>P90 (ms)</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {results.map((result, index) => (
                        <Tr key={result.endpoint}>
                          <Td
                            fontFamily="mono"
                            fontSize="xs"
                            maxW="200px"
                            isTruncated
                            title={result.endpoint}
                          >
                            {index === 0 && !result.error && (
                              <Badge colorScheme="green" mr={2}>
                                Fastest
                              </Badge>
                            )}
                            {result.endpoint.replace(/^https:\/\//, '')}
                          </Td>
                          <Td
                            isNumeric
                            fontWeight={
                              index === 0 && !result.error ? 'bold' : 'normal'
                            }
                          >
                            {result.error ? '-' : result.average.toFixed(2)}
                          </Td>
                          <Td isNumeric>
                            {result.error ? '-' : result.p50.toFixed(2)}
                          </Td>
                          <Td isNumeric>
                            {result.error ? '-' : result.p90.toFixed(2)}
                          </Td>
                          <Td>
                            {result.error ? (
                              <Badge colorScheme="red">Error</Badge>
                            ) : (
                              <Badge colorScheme="green">Online</Badge>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </CardBody>
            </Card>

            {Object.keys(historicalData).length > 0 && (
              <Card
                bg="blackAlpha.400"
                borderColor="whiteAlpha.100"
                borderWidth="1px"
              >
                <CardHeader>
                  <Heading size="md">Performance History</Heading>
                </CardHeader>
                <CardBody>
                  <Box height="300px">
                    <Line data={chartData} options={chartOptions} />
                  </Box>
                </CardBody>
              </Card>
            )}
          </VStack>
        )}
      </GridItem>
    </Grid>
  );
};

export type RpcUrl = {
  url: string;
  enabled: boolean;
};

export type AggregateResult = {
  endpoint: string;
  average: number;
  p50: number;
  p90: number;
  error: boolean;
};

function calculateAverage(latencies: number[]): number {
  return latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
}

function calculatePercentile(data: number[], percentile: number): number {
  const sortedData = [...data].sort((a, b) => a - b);
  const index = Math.ceil(percentile * sortedData.length) - 1;
  return sortedData[index];
}

interface GeoLatencyData {
  region: string;
  coordinates: [number, number];
  latency: number;
  reliability: number;
  endpoints: string[];
}

const regionCoordinates: { [key: string]: [number, number] } = {
  'US-EAST': [40.7128, -74.006],
  'US-WEST': [37.7749, -122.4194],
  'EU-CENTRAL': [50.1109, 8.6821],
  'EU-WEST': [51.5074, -0.1278],
  'ASIA-EAST': [35.6762, 139.6503],
  'ASIA-SOUTH': [19.076, 72.8777]
};

interface EndpointProfile {
  endpoint: string;
  provider: string;
  region: string;
  performance: {
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    throughput: number;
    concurrency: number;
  };
  errors: {
    type: string;
    count: number;
    lastOccurrence: Date;
    message: string;
  }[];
  recommendations: {
    type: 'warning' | 'improvement' | 'critical';
    message: string;
    impact: string;
    action: string;
  }[];
}
