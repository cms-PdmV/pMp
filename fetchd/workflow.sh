# Environment variables
BASE_PATH="/eos/cms/store/group/pdmv/jenkins_execution/tmp"
DATE_WITH_TIME=`date "+%Y_%m_%d_%H_%M_%S"`
FOLDER_NAME="pMp_Update_Workflow_$DATE_WITH_TIME"
FULL_PATH="$BASE_PATH/$FOLDER_NAME"

# Removing execution folder
rm -rf "$FULL_PATH"

# pMp Github URL
REPO_URL='https://github.com/cms-PdmV/pMp.git'
REPO_BRANCH='OpensearchSupport'

# Update script options
export DATABASE_URL='https://es-cms-pdmv.cern.ch/os/'
export CA_CERT='/etc/pki/tls/certs/ca-bundle.trust.crt'
export HOSTNAME='lxplus9.cern.ch'

# Create the execution folder
echo "Creating execution folder into: $BASE_PATH"
mkdir -p $FULL_PATH
cd $FULL_PATH

# Clone the repository and fetch the desired branch
echo "Cloning repository from: $REPO_URL"
git clone $REPO_URL
cd ./pMp/

echo "Changing branch to: $REPO_BRANCH"
git fetch && git checkout $REPO_BRANCH

# Create virtual environment and install required packages
echo "Python 3 Version: $(python3 -V)"
echo "Creating virtual environment"
python3 -m venv venv
source ./venv/bin/activate

echo "Installing packages..."
pip install -r requirements.txt

# Start the process
cd ./fetchd/
chmod 500 update_all.sh
echo "Starting update process...."
echo ""
./update_all.sh

echo "Removing execution folder located at: $FULL_PATH"
cd $HOME/
rm -rf "$FULL_PATH"