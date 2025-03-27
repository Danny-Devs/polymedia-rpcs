import { SuiClient } from '@mysten/sui/client';
import React, { useState } from 'react';
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
  useToast
} from '@chakra-ui/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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
  Title,
  Tooltip,
  Legend
);

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
        'Tests transaction search and filtering performance. Ideal for explorers and analytics tools.',
      details:
        'Queries auction-related transactions with full effects and changes.'
    }
  };

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
        // Test tx query using a specific auction function
        const bidderPackageId =
          '0x7bfe75f51565a2e03e169c85a50c490ee707692a14d5417e2b97740da0d48627';
        await client.queryTransactionBlocks({
          filter: {
            MoveFunction: {
              package: bidderPackageId,
              module: 'auction',
              function: 'admin_creates_auction'
            }
          },
          options: {
            showEffects: true,
            showObjectChanges: true,
            showInput: true
          }
        });
      }
    };

    // Run multiple rounds of latency tests
    try {
      for (let i = 0; i < numRounds; i++) {
        const newResults = await measureRpcLatency({ endpoints, rpcRequest });
        allResults.push(newResults);
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
