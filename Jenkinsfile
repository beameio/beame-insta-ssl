node('linux')
{
    stage('Checkout') {
      checkout scm
    }
    stage('Test') {
          sh('make test')
    }

}
