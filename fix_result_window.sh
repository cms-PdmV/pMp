# Set the following environment variables
# ENGINE_ENDPOINT: Elasticsearch or Opensearch endpoint: 'http://localhost:9200', without trailing slash :)
# KERBEROS: Set this if you attempt to authenticate via Kerberos, it would be required for Opensearch
SPACE="=======\n\n"
INDICES=(
    'campaigns'
    'chained_campaigns' 
    'chained_requests' 
    'flows'
    'last_sequences'
    'mcm_dataset_names'
    'mcm_datatiers'
    'ppd_tags'
    'processing_strings'
    'relval_campaigns'
    'relval_cmssw_versions'
    'relval_requests'
    'requests'
    'rereco_campaigns'
    'rereco_requests'
    'tags'
    'workflows'
)
TOTAL_INDICES=${#INDICES[@]}

function update_result_window() {
    local index=$1
    local http_request="$ENGINE_ENDPOINT/$index/_settings"
    local body='{"index": {"max_result_window": 1000000}}'
    
    echo "Request: $http_request - Body: $body"
    if [ -z $KERBEROS ]; then
        # Kerberos authentication is not set
        curl -H 'Content-Type: application/json' \
        -X PUT "$http_request" \
        -d "$body"
    else
        echo "Using Kerberos authentication"
        curl -H 'Content-Type: application/json' \
        -X PUT "$http_request" \
        -u : --negotiate \
        -d "$body"
    fi
}

# Execute the change
for i in ${!INDICES[@]}; do
    INDEX=$(($i+1))
    CURRENT=${INDICES[$i]}
    echo "Index $INDEX:$TOTAL_INDICES => $CURRENT"
    echo "Starting at: $(date)"
    printf $SPACE
    update_result_window $CURRENT
    printf "\n\n"
    echo "Finished at: $(date)"
    printf $SPACE
done
