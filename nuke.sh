curl -X DELETE -s localhost:9200/workflows
curl -X DELETE -s localhost:9200/rereco_requests
curl -X DELETE -s localhost:9200/requests
curl -X DELETE -s localhost:9200/chained_requests
curl -X DELETE -s localhost:9200/campaigns
curl -X DELETE -s localhost:9200/chained_campaigns
curl -X DELETE -s localhost:9200/flows

curl -X DELETE -s localhost:9200/last_sequences

# curl -X PUT localhost:9200/last_sequences/last_seq/requests -d '{"val":"3500000"}' -H "Content-Type: application/json"
# curl -X PUT localhost:9200/last_sequences/last_seq/workflows -d '{"val":"296128-g1AAAAJ7eJzLYWBg4MhgTmEQTM4vTc5ISXIwNDLXMwBCwxygFFMiQ5L8____szKYkxgY-k_nAsXYDZLNkpONUrHpwWNSkgKQTLKHGzbxONiw5DRLQ8Mkkg1zABkWDzdsigPYMDMji0RjU0NSDUsAGVaP8KYfxGUGFkmJqeYkGpbHAiQZGoAU0Lz5UAONIeGWkmKSlppGloELIAbuhxjYJwM2MMkyNdHY3JgsAw9ADLwPMXDCUrCBRqmGZqmGpEYGxMAHEANhsbsGbKCJaZKpmaElNq1ZABM-p-g"}' -H "Content-Type: application/json"
# curl -X PUT localhost:9200/last_sequences/last_seq/chained_requests -d '{"val":"120000"}' -H "Content-Type: application/json"
