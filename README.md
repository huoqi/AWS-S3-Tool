AWS-S3-Tool
===========

A static html page tool for AWS S3

###### Example: <https://s3.amazonaws.com/aws-s3-tool.xinjian.io/index.html>

#### Usage:
  * For global, you should upload these files to any bucket of _US-Standard_ region, and set them public readable.
  * For China Region, you should upload these files to any bucket of _CN-NORTH-1_ region, and set them public readable.
  * Open the _index.html_, input _accessKey_ and _secretAccessKey_ and then click _OK_ button.   
   **Notice:** You should use the HTTPS not HTTP, otherwise parts of functions cannot work.
  * If you want to manage a bucket locates on other region, please configure the CORS configuration like:
   <?xml version="1.0" encoding="UTF-8"?>
    <CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <CORSRule>
        <AllowedOrigin>https://s3.amazonaws.com</AllowedOrigin>
        <AllowedMethod>GET</AllowedMethod>
        <AllowedMethod>PUT</AllowedMethod>
        <AllowedMethod>DELETE</AllowedMethod>
        <MaxAgeSeconds>3000</MaxAgeSeconds>
        <AllowedHeader>*</AllowedHeader>
      </CORSRule>
    </CORSConfiguration>
     
