import { DockerService } from './services/docker-service';

async function testDockerService() {
  const docker = new DockerService();

  console.log('Checking Docker status...');
  const isDockerRunning = await docker.checkDockerStatus();
  console.log('Docker running:', isDockerRunning);

  if (!isDockerRunning) {
    console.error('Docker is not running. Please start Docker Desktop first.');
    return;
  }

  console.log('\nStarting NebulaGraph services...');
  const startResult = await docker.startServices();
  console.log('Start result:', startResult);

  if (startResult.success) {
    console.log('\nWaiting 10 seconds before checking service status...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\nGetting services status...');
    const status = await docker.getServicesStatus();
    console.log('Services status:', JSON.stringify(status, null, 2));

    console.log('\nGetting service logs...');
    const logs = await docker.getServiceLogs('graphd');
    console.log('Graph service logs:', logs.slice(0, 5));

    console.log('\nStopping services...');
    const stopResult = await docker.stopServices();
    console.log('Stop result:', stopResult);
  }
}

testDockerService().catch(console.error); 