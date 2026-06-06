// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CredentialRegistry {
    address public owner;
    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => bool) public revokedCredentials;

    event IssuerUpdated(address indexed issuer, bool authorized);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "unauthorized issuer");
        _;
    }

    function setIssuer(address issuer, bool authorized) external onlyOwner {
        authorizedIssuers[issuer] = authorized;
        emit IssuerUpdated(issuer, authorized);
    }

    function revokeCredential(bytes32 credentialId) external onlyAuthorizedIssuer {
        revokedCredentials[credentialId] = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }
}
